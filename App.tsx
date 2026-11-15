import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Product = { id: string; name: string; sku: string; price: number; stock: number; category: string };
type CartLine = { productId: string; qty: number };
type Order = { id: string; date: string; total: number; items: { name: string; qty: number; price: number }[] };

const KEY = "retail-manager-v1";
const initialProducts: Product[] = [
  { id: "p1", name: "Rice (5 kg)", sku: "GRC-001", price: 650, stock: 24, category: "Groceries" },
  { id: "p2", name: "Cooking Oil (1 L)", sku: "GRC-002", price: 280, stock: 18, category: "Groceries" },
  { id: "p3", name: "Bathing Soap", sku: "HPC-001", price: 85, stock: 42, category: "Personal care" },
  { id: "p4", name: "Notebook", sku: "STA-001", price: 75, stock: 7, category: "Stationery" },
  { id: "p5", name: "Toothpaste", sku: "HPC-002", price: 160, stock: 3, category: "Personal care" }
];

const money = (n: number) => "Rs. " + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const id = () => Math.random().toString(36).slice(2, 10);

export default function App() {
  const [tab, setTab] = useState("Home");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", sku: "", price: "", stock: "", category: "General" });

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const data = JSON.parse(raw);
          setProducts(data.products || initialProducts);
          setOrders(data.orders || []);
        }
      } catch { Alert.alert("Storage issue", "Saved data could not be loaded. Sample data is shown."); }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify({ products, orders })).catch(() => {});
  }, [products, orders, loaded]);

  const todayOrders = orders.filter(o => new Date(o.date).toDateString() === new Date().toDateString());
  const todaySales = todayOrders.reduce((s, o) => s + o.total, 0);
  const lowStock = products.filter(p => p.stock <= 5);
  const cartTotal = cart.reduce((sum, line) => {
    const p = products.find(x => x.id === line.productId);
    return sum + (p ? p.price * line.qty : 0);
  }, 0);
  const filtered = useMemo(() => products.filter(p =>
    (p.name + " " + p.sku + " " + p.category).toLowerCase().includes(query.toLowerCase())
  ), [products, query]);

  const openNew = () => {
    setEditing(null); setForm({ name: "", sku: "", price: "", stock: "", category: "General" }); setModal(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p); setForm({ name: p.name, sku: p.sku, price: String(p.price), stock: String(p.stock), category: p.category }); setModal(true);
  };
  const saveProduct = () => {
    const price = Number(form.price), stock = Number(form.stock);
    if (!form.name.trim() || !form.sku.trim() || form.price.trim() === "" || form.stock.trim() === "" ||
        !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      Alert.alert("Check product details", "Enter a name, SKU, valid price and whole-number stock quantity.");
      return;
    }
    if (editing) {
      setProducts(old => old.map(p => p.id === editing.id ? { ...p, ...form, price, stock } : p));
    } else {
      setProducts(old => [{ id: id(), ...form, price, stock }, ...old]);
    }
    setModal(false);
  };
  const deleteProduct = (p: Product) => Alert.alert("Delete product?", `Remove ${p.name} from inventory?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => {
      setProducts(old => old.filter(x => x.id !== p.id));
      setCart(old => old.filter(x => x.productId !== p.id));
    }}
  ]);
  const addToCart = (p: Product) => {
    if (p.stock < 1) { Alert.alert("Out of stock", `${p.name} has no stock available.`); return; }
    const current = cart.find(x => x.productId === p.id)?.qty || 0;
    if (current >= p.stock) { Alert.alert("Stock limit", "There is not enough stock for that quantity."); return; }
    setCart(old => current ? old.map(x => x.productId === p.id ? { ...x, qty: x.qty + 1 } : x) : [...old, { productId: p.id, qty: 1 }]);
  };
  const changeQty = (productId: string, delta: number) => {
    const p = products.find(x => x.id === productId);
    setCart(old => old.map(x => x.productId === productId ? { ...x, qty: Math.max(0, Math.min(p?.stock || 0, x.qty + delta)) } : x).filter(x => x.qty > 0));
  };
  const checkout = () => {
    if (!cart.length) { Alert.alert("Cart is empty", "Add products before checkout."); return; }
    const lines = cart.map(line => {
      const p = products.find(x => x.id === line.productId)!;
      return { name: p.name, qty: line.qty, price: p.price };
    });
    const total = lines.reduce((s, x) => s + x.qty * x.price, 0);
    const order: Order = { id: "ORD-" + id().toUpperCase(), date: new Date().toISOString(), total, items: lines };
    setProducts(old => old.map(p => {
      const line = cart.find(x => x.productId === p.id);
      return line ? { ...p, stock: p.stock - line.qty } : p;
    }));
    setOrders(old => [order, ...old]);
    setCart([]);
    Alert.alert("Sale completed", `${order.id}\nTotal: ${money(total)}`);
    setTab("Orders");
  };

  const Header = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <View style={styles.header}>
      <View><Text style={styles.eyebrow}>RETAIL MANAGER</Text><Text style={styles.heading}>{title}</Text>{!!subtitle && <Text style={styles.subheading}>{subtitle}</Text>}</View>
      <View style={styles.avatar}><Text style={styles.avatarText}>RM</Text></View>
    </View>
  );
  const Stat = ({ label, value, hint, accent }: any) => (
    <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text><Text style={[styles.statHint, accent && { color: "#D97706" }]}>{hint}</Text></View>
  );
  const ProductRow = ({ item, pos }: { item: Product; pos?: boolean }) => (
    <View style={styles.productRow}>
      <View style={styles.productIcon}><Text style={styles.productIconText}>{item.name.slice(0,1).toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.muted}>{item.sku} · {item.category} · Stock: {item.stock}</Text>
        <Text style={styles.price}>{money(item.price)}</Text>
      </View>
      {pos ? <TouchableOpacity style={styles.smallButton} onPress={() => addToCart(item)}><Text style={styles.smallButtonText}>+ Add</Text></TouchableOpacity> :
        <View style={styles.rowActions}><TouchableOpacity onPress={() => openEdit(item)}><Text style={styles.actionText}>Edit</Text></TouchableOpacity><TouchableOpacity onPress={() => deleteProduct(item)}><Text style={[styles.actionText, { color: "#DC5555" }]}>Delete</Text></TouchableOpacity></View>}
    </View>
  );

  const Home = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.page}>
      <Header title="Overview" subtitle="Your store at a glance" />
      <View style={styles.statGrid}>
        <Stat label="TODAY'S SALES" value={money(todaySales)} hint={`${todayOrders.length} completed orders`} />
        <Stat label="TOTAL ORDERS" value={String(orders.length)} hint="All recorded sales" />
        <Stat label="PRODUCTS" value={String(products.length)} hint="In your inventory" />
        <Stat label="LOW STOCK" value={String(lowStock.length)} hint="5 units or fewer" accent />
      </View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Quick actions</Text></View>
      <View style={styles.quickGrid}>
        <TouchableOpacity style={styles.quickCard} onPress={() => setTab("POS")}><Text style={styles.quickIcon}>＋</Text><Text style={styles.quickTitle}>New sale</Text><Text style={styles.muted}>Open checkout</Text></TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={openNew}><Text style={styles.quickIcon}>▣</Text><Text style={styles.quickTitle}>Add product</Text><Text style={styles.muted}>Update inventory</Text></TouchableOpacity>
      </View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Stock alerts</Text><TouchableOpacity onPress={() => setTab("Products")}><Text style={styles.link}>View inventory</Text></TouchableOpacity></View>
      {lowStock.length ? lowStock.slice(0,4).map(p => <ProductRow key={p.id} item={p} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>Stock looks healthy</Text><Text style={styles.muted}>No products are at or below 5 units.</Text></View>}
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent sales</Text><TouchableOpacity onPress={() => setTab("Orders")}><Text style={styles.link}>See all</Text></TouchableOpacity></View>
      {orders.slice(0,3).map(o => <View style={styles.orderRow} key={o.id}><View><Text style={styles.productName}>{o.id}</Text><Text style={styles.muted}>{new Date(o.date).toLocaleString()}</Text></View><Text style={styles.price}>{money(o.total)}</Text></View>)}
      {!orders.length && <View style={styles.empty}><Text style={styles.muted}>Your completed sales will appear here.</Text></View>}
    </ScrollView>
  );

  const Products = () => (
    <View style={styles.page}>
      <Header title="Inventory" subtitle={`${products.length} products in your store`} />
      <View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search name, SKU or category" placeholderTextColor="#98A2B3" style={styles.searchInput} /></View>
      <TouchableOpacity style={styles.primaryButton} onPress={openNew}><Text style={styles.primaryButtonText}>＋  Add product</Text></TouchableOpacity>
      <FlatList data={filtered} keyExtractor={x => x.id} renderItem={({ item }) => <ProductRow item={item} />} contentContainerStyle={{ paddingBottom: 24 }} ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>No matching products found.</Text></View>} />
    </View>
  );

  const POS = () => (
    <View style={styles.page}>
      <Header title="New sale" subtitle="Select products and check out" />
      <View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Find a product" placeholderTextColor="#98A2B3" style={styles.searchInput} /></View>
      <FlatList data={filtered} keyExtractor={x => x.id} renderItem={({ item }) => <ProductRow item={item} pos />} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }} />
      <View style={styles.cartPanel}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Cart ({cart.reduce((s,x)=>s+x.qty,0)})</Text><TouchableOpacity onPress={() => setCart([])}><Text style={styles.actionText}>Clear</Text></TouchableOpacity></View>
        {cart.length ? cart.map(line => {
          const p = products.find(x => x.id === line.productId);
          if (!p) return null;
          return <View style={styles.cartLine} key={line.productId}><View style={{ flex: 1 }}><Text style={styles.productName}>{p.name}</Text><Text style={styles.muted}>{money(p.price)} each</Text></View><TouchableOpacity onPress={() => changeQty(p.id,-1)} style={styles.qtyButton}><Text>−</Text></TouchableOpacity><Text style={styles.qty}>{line.qty}</Text><TouchableOpacity onPress={() => changeQty(p.id,1)} style={styles.qtyButton}><Text>＋</Text></TouchableOpacity></View>;
        }) : <Text style={styles.muted}>Your cart is empty. Add an item above.</Text>}
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{money(cartTotal)}</Text></View>
        <TouchableOpacity style={[styles.primaryButton, !cart.length && { opacity: .45 }]} onPress={checkout}><Text style={styles.primaryButtonText}>Complete sale</Text></TouchableOpacity>
      </View>
    </View>
  );

  const Orders = () => (
    <View style={styles.page}>
      <Header title="Sales history" subtitle={`${orders.length} recorded transactions`} />
      <FlatList data={orders} keyExtractor={x => x.id} contentContainerStyle={{ paddingBottom: 24 }} renderItem={({ item }) => (
        <View style={styles.orderCard}><View style={styles.orderTop}><View><Text style={styles.productName}>{item.id}</Text><Text style={styles.muted}>{new Date(item.date).toLocaleString()}</Text></View><Text style={styles.price}>{money(item.total)}</Text></View><Text style={styles.muted}>{item.items.map(x => `${x.name} × ${x.qty}`).join("  ·  ")}</Text></View>
      )} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No sales yet</Text><Text style={styles.muted}>Complete a sale in POS and it will show here.</Text></View>} />
    </View>
  );

  const Settings = () => (
    <ScrollView contentContainerStyle={styles.page}>
      <Header title="Settings" subtitle="Store preferences" />
      <View style={styles.settingCard}><Text style={styles.sectionTitle}>Store profile</Text><Text style={styles.muted}>Store name</Text><Text style={styles.productName}>My Retail Store</Text><Text style={styles.muted}>Country / currency</Text><Text style={styles.productName}>Nepal · NPR (Rs.)</Text><Text style={styles.muted}>Business type</Text><Text style={styles.productName}>Single retail store</Text></View>
      <View style={styles.settingCard}><Text style={styles.sectionTitle}>Data & privacy</Text><Text style={styles.muted}>Your products and sales are saved locally on this device. This starter version does not sync to a cloud account.</Text></View>
      <TouchableOpacity style={styles.outlineButton} onPress={() => Alert.alert("Sample data", "This restores the sample products and clears recorded orders. Continue?", [{text:"Cancel",style:"cancel"},{text:"Reset",style:"destructive",onPress:()=>{setProducts(initialProducts);setOrders([]);setCart([]);}}])}><Text style={styles.dangerText}>Reset app data</Text></TouchableOpacity>
      <Text style={styles.version}>Retail Manager · Version 1.0.0</Text>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F7FB" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {tab === "Home" ? <Home /> : tab === "Products" ? <Products /> : tab === "POS" ? <POS /> : tab === "Orders" ? <Orders /> : <Settings />}
        <View style={styles.nav}>
          {[
            ["Home","⌂"],["Products","▤"],["POS","＋"],["Orders","▧"],["Settings","⚙"]
          ].map(([name, glyph]) => <TouchableOpacity key={name} style={styles.navItem} onPress={() => { setQuery(""); setTab(name); }}>
            <Text style={[styles.navGlyph, tab === name && styles.navActive]}>{glyph}</Text><Text style={[styles.navText, tab === name && styles.navActive]}>{name}</Text>
          </TouchableOpacity>)}
        </View>
      </KeyboardAvoidingView>
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalShade}><View style={styles.modalCard}>
          <View style={styles.modalHeader}><Text style={styles.sectionTitle}>{editing ? "Edit product" : "Add product"}</Text><TouchableOpacity onPress={() => setModal(false)}><Text style={styles.actionText}>Close</Text></TouchableOpacity></View>
          {(["name","sku","category","price","stock"] as const).map(k => <View key={k} style={styles.field}><Text style={styles.fieldLabel}>{k.toUpperCase()}</Text><TextInput value={form[k]} onChangeText={v => setForm(old => ({...old,[k]:v}))} placeholder={k === "category" ? "General" : `Enter ${k}`} keyboardType={k === "price" || k === "stock" ? "decimal-pad" : "default"} style={styles.fieldInput} placeholderTextColor="#A0A8B5" /></View>)}
          <TouchableOpacity style={styles.primaryButton} onPress={saveProduct}><Text style={styles.primaryButtonText}>Save product</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F6F7FB"}, page:{flex:1,paddingHorizontal:18,paddingTop:12}, header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:20}, eyebrow:{fontSize:10,letterSpacing:1.5,color:"#788398",fontWeight:"800"}, heading:{fontSize:28,fontWeight:"800",color:"#172033",marginTop:3}, subheading:{fontSize:13,color:"#8993A5",marginTop:3}, avatar:{width:42,height:42,borderRadius:15,backgroundColor:"#E6ECFF",alignItems:"center",justifyContent:"center"},avatarText:{fontWeight:"800",color:"#5369B5"},
  statGrid:{flexDirection:"row",flexWrap:"wrap",gap:10}, stat:{width:"48%",flexGrow:1,backgroundColor:"#FFFFFF",borderRadius:17,padding:15,borderWidth:1,borderColor:"#EEF0F5"},statLabel:{fontSize:10,fontWeight:"800",letterSpacing:.7,color:"#8A94A6"},statValue:{fontSize:21,fontWeight:"800",color:"#182238",marginTop:8},statHint:{fontSize:11,color:"#21966D",marginTop:5},
  sectionHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:22,marginBottom:11},sectionTitle:{fontSize:16,fontWeight:"800",color:"#202A3D"},link:{fontSize:12,color:"#5369B5",fontWeight:"700"},quickGrid:{flexDirection:"row",gap:10},quickCard:{flex:1,backgroundColor:"#FFFFFF",borderRadius:17,padding:15,borderWidth:1,borderColor:"#EEF0F5"},quickIcon:{fontSize:24,color:"#5369B5"},quickTitle:{fontSize:14,fontWeight:"800",color:"#202A3D",marginTop:8},muted:{fontSize:11,color:"#8A94A6",marginTop:3},empty:{backgroundColor:"#FFFFFF",padding:20,borderRadius:15,alignItems:"center",marginTop:8},emptyTitle:{fontWeight:"800",color:"#263148",marginBottom:4},
  productRow:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFFFFF",padding:12,borderRadius:15,marginBottom:8,borderWidth:1,borderColor:"#F0F1F5",gap:10},productIcon:{width:40,height:40,borderRadius:13,backgroundColor:"#EEF1FF",alignItems:"center",justifyContent:"center"},productIconText:{fontWeight:"800",fontSize:16,color:"#5369B5"},productName:{fontSize:13,fontWeight:"800",color:"#202A3D"},price:{fontSize:13,fontWeight:"800",color:"#202A3D",marginTop:4},rowActions:{gap:12},actionText:{fontSize:12,fontWeight:"700",color:"#5369B5"},smallButton:{backgroundColor:"#EEF1FF",paddingHorizontal:13,paddingVertical:9,borderRadius:10},smallButtonText:{color:"#5369B5",fontSize:12,fontWeight:"800"},
  search:{height:46,backgroundColor:"#FFFFFF",borderRadius:13,borderWidth:1,borderColor:"#ECEEF3",flexDirection:"row",alignItems:"center",paddingHorizontal:13,marginBottom:12},searchIcon:{fontSize:23,color:"#8A94A6",marginRight:8},searchInput:{flex:1,fontSize:13,color:"#202A3D"},primaryButton:{backgroundColor:"#5369B5",borderRadius:13,paddingVertical:14,alignItems:"center",marginBottom:12},primaryButtonText:{color:"#FFFFFF",fontSize:13,fontWeight:"800"},
  nav:{flexDirection:"row",backgroundColor:"#FFFFFF",borderTopWidth:1,borderTopColor:"#ECEEF3",paddingTop:9,paddingBottom:Platform.OS==="android"?10:5},navItem:{flex:1,alignItems:"center",gap:3},navGlyph:{fontSize:19,color:"#A0A8B5"},navText:{fontSize:9,color:"#929BAD",fontWeight:"700"},navActive:{color:"#5369B5"},
  cartPanel:{backgroundColor:"#FFFFFF",borderTopLeftRadius:18,borderTopRightRadius:18,padding:14,marginHorizontal:-18,borderTopWidth:1,borderColor:"#ECEEF3"},cartLine:{flexDirection:"row",alignItems:"center",paddingVertical:7,gap:10},qtyButton:{width:28,height:28,borderRadius:9,backgroundColor:"#EEF1FF",alignItems:"center",justifyContent:"center"},qty:{fontWeight:"800",color:"#202A3D",minWidth:15,textAlign:"center"},totalRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",borderTopWidth:1,borderColor:"#ECEEF3",paddingTop:11,marginTop:5,marginBottom:12},totalLabel:{fontWeight:"700",color:"#647087"},totalValue:{fontSize:19,fontWeight:"900",color:"#202A3D"},
  orderRow:{backgroundColor:"#FFFFFF",borderRadius:14,padding:14,marginBottom:8,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},orderCard:{backgroundColor:"#FFFFFF",borderRadius:15,padding:15,marginBottom:10,borderWidth:1,borderColor:"#F0F1F5"},orderTop:{flexDirection:"row",justifyContent:"space-between",marginBottom:10},settingCard:{backgroundColor:"#FFFFFF",borderRadius:16,padding:16,marginBottom:12,gap:9},outlineButton:{borderWidth:1,borderColor:"#F0CACA",padding:14,borderRadius:13,alignItems:"center",marginTop:5},dangerText:{color:"#CF4F4F",fontWeight:"800"},version:{textAlign:"center",color:"#A0A8B5",fontSize:10,marginTop:20,marginBottom:20},
  modalShade:{flex:1,backgroundColor:"rgba(15,23,42,.45)",justifyContent:"flex-end"},modalCard:{backgroundColor:"#F8F9FC",borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,paddingBottom:30},modalHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:15},field:{marginBottom:11},fieldLabel:{fontSize:10,fontWeight:"800",letterSpacing:1,color:"#7D8799",marginBottom:5},fieldInput:{height:44,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E9ECF2",borderRadius:11,paddingHorizontal:12,color:"#202A3D",fontSize:13}
});
