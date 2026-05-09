import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, X } from 'lucide-react';
import purchaseOrderService from '../services/purchaseOrderService';
import notify from '../services/notificationService';

const ReceivePurchaseOrderModal = ({ po, onClose, onSuccess }) => {
  const [receiving, setReceiving] = useState(false);
  const [items, setItems] = useState(() =>
    (po.items || []).map(item => ({
      po_item_id: item.po_item_id,
      product_name: item.product_name,
      quantity_ordered: Number(item.quantity_ordered),
      quantity_received: Number(item.quantity_received || 0),
      remaining: Number(item.quantity_ordered) - Number(item.quantity_received || 0)
    }))
  );

  const handleQuantityChange = (poItemId, value) => {
    const qty = Math.max(0, parseInt(value) || 0);
    setItems(prev => prev.map(item =>
      item.po_item_id === poItemId
        ? { ...item, receiveQty: Math.min(qty, item.remaining) }
        : item
    ));
  };

  const handleSubmit = async () => {
    const itemsToReceive = items
      .filter(item => item.receiveQty > 0)
      .map(item => ({
        po_item_id: item.po_item_id,
        quantity_received: item.receiveQty
      }));

    if (itemsToReceive.length === 0) {
      notify.error('Select at least one item to receive');
      return;
    }

    try {
      setReceiving(true);
      const res = await purchaseOrderService.receivePurchaseOrder(po.po_id, itemsToReceive);
      if (res.success) {
        notify.success(`Stock updated. PO is now ${res.data.status}.`);
        onSuccess();
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to receive items';
      notify.error(msg);
    } finally {
      setReceiving(false);
    }
  };

  const totalReceive = items.reduce((sum, item) => sum + (item.receiveQty || 0), 0);
  const hasItemsToReceive = items.some(item => item.receiveQty > 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-elevated rounded-2xl p-6 max-w-2xl w-full border border-default max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Package size={20} /> Receive Purchase Order
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-section">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-muted mb-4">
          Enter quantities for items being received. Stock will be incremented automatically.
        </p>

        <div className="space-y-3 mb-6">
          {items.map(item => (
            <div key={item.po_item_id} className="flex items-center gap-4 p-3 bg-section rounded-xl">
              <div className="flex-1">
                <div className="font-medium text-sm">{item.product_name}</div>
                <div className="text-xs text-muted">
                  Ordered: {item.quantity_ordered} | Received: {item.quantity_received} | Remaining: {item.remaining}
                </div>
              </div>
              <div className="w-24">
                <input
                  type="number"
                  min={0}
                  max={item.remaining}
                  value={item.receiveQty || ''}
                  onChange={(e) => handleQuantityChange(item.po_item_id, e.target.value)}
                  placeholder="0"
                  className="w-full bg-base border border-default rounded-lg px-2 py-1.5 text-right text-primary"
                />
              </div>
              <div className="text-xs text-muted w-16 text-right">
                max {item.remaining}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center">
          <div className="text-sm text-muted">
            Total: {totalReceive} item(s) to receive
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={receiving}
              className="px-4 py-2 rounded-xl bg-section text-primary font-semibold hover:bg-elevated border border-default"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={receiving || !hasItemsToReceive}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-2"
            >
              <Package size={16} />
              {receiving ? 'Receiving...' : 'Receive Selected'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ReceivePurchaseOrderModal;