"use client";
import { useEffect, useState } from "react";

type Order = {
  id: string;
  customerName: string;
  phone: string;
  district: string;
  thana: string;
  address: string;
  product: string;
  quantity: number;
  senderId: string;
  facebookName: string;
  status: string;
  notes: string;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  CONFIRMED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SHIPPED:   "bg-purple-500/20 text-purple-400 border-purple-500/30",
  DELIVERED: "bg-green-500/20 text-green-400 border-green-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_BN: Record<string, string> = {
  PENDING:   "অপেক্ষমান",
  CONFIRMED: "নিশ্চিত",
  SHIPPED:   "পাঠানো হয়েছে",
  DELIVERED: "ডেলিভারি হয়েছে",
  CANCELLED: "বাতিল",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = async (status = filter) => {
    setLoading(true);
    try {
      const q = status !== "ALL" ? `?status=${status}` : "";
      const res = await fetch(`/api/orders${q}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await fetchOrders();
    setUpdating(null);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("bn-BD", { dateStyle: "short", timeStyle: "short" });

  const pendingCount = orders.filter(o => o.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              📦 অর্ডার ড্যাশবোর্ড
            </h1>
            <p className="text-gray-400 text-sm mt-1">Bot থেকে আসা সব অর্ডার এখানে দেখা যাবে</p>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                🔔 {pendingCount}টি নতুন অর্ডার
              </span>
            )}
            <button
              onClick={() => fetchOrders()}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 px-4 py-2 rounded-lg text-sm transition"
            >
              🔄 রিফ্রেশ
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          {["ALL", "PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`p-3 rounded-xl border text-center transition ${
                filter === s
                  ? "bg-amber-500/30 border-amber-500 text-amber-300"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
              }`}
            >
              <div className="text-lg font-bold">{s === "ALL" ? total : orders.filter(o => o.status === s).length}</div>
              <div className="text-xs">{s === "ALL" ? "সব" : STATUS_BN[s]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mr-3" />
          লোড হচ্ছে...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-lg">এখনো কোনো অর্ডার আসেনি</p>
          <p className="text-sm mt-2">Bot-এ কেউ অর্ডার confirm করলে এখানে দেখা যাবে</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <div
              key={order.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-amber-500/30 transition"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                {/* Left: Customer Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-gray-500 text-xs">#{total - i}</span>
                    <h3 className="font-bold text-white text-lg">{order.customerName}</h3>
                    {order.facebookName && order.facebookName !== order.customerName && (
                      <span className="text-xs text-gray-500">(FB: {order.facebookName})</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || ""}`}>
                      {STATUS_BN[order.status] || order.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-300">
                      <span className="text-gray-500">📱</span>
                      <a href={`tel:${order.phone}`} className="hover:text-amber-400 transition font-mono">{order.phone}</a>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <span className="text-gray-500">📍</span>
                      <span>{[order.address, order.thana, order.district].filter(Boolean).join(", ")}</span>
                    </div>
                    {order.product && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <span className="text-gray-500">💊</span>
                        <span className="text-amber-300">{order.product}</span>
                        {order.quantity > 1 && <span className="text-gray-400">× {order.quantity}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                      <span className="text-gray-500">🕐</span>
                      {formatDate(order.createdAt)}
                    </div>
                  </div>

                  {order.notes && (
                    <div className="mt-2 text-xs text-gray-400 bg-white/5 rounded px-2 py-1">
                      📝 {order.notes}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap gap-2 md:flex-col md:w-36">
                  {order.status === "PENDING" && (
                    <button
                      onClick={() => updateStatus(order.id, "CONFIRMED")}
                      disabled={updating === order.id}
                      className="bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg text-xs transition w-full"
                    >
                      ✅ নিশ্চিত করুন
                    </button>
                  )}
                  {order.status === "CONFIRMED" && (
                    <button
                      onClick={() => updateStatus(order.id, "SHIPPED")}
                      disabled={updating === order.id}
                      className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-400 px-3 py-1.5 rounded-lg text-xs transition w-full"
                    >
                      🚚 পাঠিয়ে দিন
                    </button>
                  )}
                  {order.status === "SHIPPED" && (
                    <button
                      onClick={() => updateStatus(order.id, "DELIVERED")}
                      disabled={updating === order.id}
                      className="bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-lg text-xs transition w-full"
                    >
                      ✅ ডেলিভারি হয়েছে
                    </button>
                  )}
                  {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
                    <button
                      onClick={() => updateStatus(order.id, "CANCELLED")}
                      disabled={updating === order.id}
                      className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs transition w-full"
                    >
                      ❌ বাতিল
                    </button>
                  )}
                  <a
                    href={`https://m.me/${order.senderId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 px-3 py-1.5 rounded-lg text-xs transition w-full text-center"
                  >
                    💬 মেসেজ করুন
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
