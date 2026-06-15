import { useState, useEffect } from 'react';
import { LogOut, Package, Search, ChevronDown } from 'lucide-react';
import { supabase, type Order } from '../lib/supabase';

type UserDashboardProps = {
  userData: { id: string; email: string; name: string };
  onLogout: () => void;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  confirmed: { label: 'Confirmed', color: 'text-blue-700', bg: 'bg-blue-100' },
  processing: { label: 'Processing', color: 'text-orange-700', bg: 'bg-orange-100' },
  ready: { label: 'Ready', color: 'text-teal-700', bg: 'bg-teal-100' },
  delivered: { label: 'Delivered', color: 'text-green-700', bg: 'bg-green-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function UserDashboard({ userData, onLogout }: UserDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUserOrders();
  }, [userData]);

  async function fetchUserOrders() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .ilike('customer_email', userData.email)
        .order('created_at', { ascending: false });
      setOrders(data ?? []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter(
    (o) =>
      o.order_number.includes(searchQuery.toUpperCase()) ||
      o.livestock_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.order_status === 'pending').length,
    confirmed: orders.filter((o) => o.order_status === 'confirmed').length,
    delivered: orders.filter((o) => o.order_status === 'delivered').length,
    total_spent: orders
      .filter((o) => o.payment_status === 'confirmed')
      .reduce((sum, o) => sum + o.total_amount, 0),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
            <p className="text-gray-600 text-sm">Welcome, {userData.name}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-semibold transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Orders', value: stats.total, color: 'text-gray-900' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
            { label: 'Confirmed', value: stats.confirmed, color: 'text-blue-600' },
            { label: 'Delivered', value: stats.delivered, color: 'text-green-600' },
            { label: 'Total Spent', value: fmt(stats.total_spent), color: 'text-green-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order number or livestock..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-8 h-8 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-gray-600 mt-4">Loading your orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 font-medium">No orders found</p>
              <p className="text-gray-400 text-sm mt-1">
                {orders.length === 0 ? 'You haven\'t placed any orders yet.' : 'No orders match your search.'}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">Order #{order.order_number}</p>
                        <p className="text-sm text-gray-600">{order.livestock_name} • {order.quantity} {order.unit}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          STATUS_CONFIG[order.order_status]?.bg
                        } ${STATUS_CONFIG[order.order_status]?.color}`}
                      >
                        {STATUS_CONFIG[order.order_status]?.label}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.payment_status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {order.payment_status === 'confirmed' ? 'Paid' : 'Pending Payment'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{fmt(order.total_amount)}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-gray-400 ml-2 transition-transform ${
                      expandedOrder === order.id ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {/* Expanded Details */}
                {expandedOrder === order.id && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-600 font-medium">Delivery Address</p>
                        <p className="text-sm text-gray-900 mt-1">{order.delivery_address}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-medium">Delivery Date</p>
                        <p className="text-sm text-gray-900 mt-1">
                          {order.delivery_date
                            ? new Date(order.delivery_date).toLocaleDateString()
                            : 'To be confirmed'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-medium">Payment Method</p>
                        <p className="text-sm text-gray-900 mt-1">{order.payment_method}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-medium">Subtotal</p>
                        <p className="text-sm text-gray-900 mt-1">{fmt(order.subtotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-medium">Delivery Fee</p>
                        <p className="text-sm text-gray-900 mt-1">{fmt(order.delivery_fee)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-medium">Total Amount</p>
                        <p className="text-sm font-bold text-gray-900 mt-1">{fmt(order.total_amount)}</p>
                      </div>
                    </div>

                    {order.customer_comment && (
                      <div>
                        <p className="text-xs text-gray-600 font-medium">Your Comments</p>
                        <p className="text-sm text-gray-900 mt-1">{order.customer_comment}</p>
                      </div>
                    )}

                    {order.notes && (
                      <div>
                        <p className="text-xs text-gray-600 font-medium">Admin Notes</p>
                        <p className="text-sm text-gray-900 mt-1">{order.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
