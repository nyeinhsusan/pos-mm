import { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [cartDiscount, setCartDiscount] = useState(null); // {type, value, amount, reason}
  const [itemDiscounts, setItemDiscounts] = useState({}); // {product_id: {type, value, amount, reason}}

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(
        (item) => item.product_id === product.product_id
      );

      if (existingItem) {
        // Increment quantity if product already in cart
        return prevCart.map((item) =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Add new item to cart
        return [
          ...prevCart,
          {
            product_id: product.product_id,
            name: product.name,
            price: parseFloat(product.price),
            stock_quantity: product.stock_quantity,
            quantity: 1
          }
        ];
      }
    });
  };

  const removeFromCart = (product_id) => {
    setCart((prevCart) =>
      prevCart.filter((item) => item.product_id !== product_id)
    );
  };

  const updateQuantity = (product_id, quantity) => {
    if (quantity <= 0) {
      removeFromCart(product_id);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product_id === product_id ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setCartDiscount(null);
    setItemDiscounts({});
  };

  const applyCartDiscount = (discountData) => {
    // discountData: {type: 'percentage'|'fixed', value: number, reason: string}
    const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    let discountAmount = 0;

    if (discountData.type === 'percentage') {
      discountAmount = subtotal * (discountData.value / 100);
    } else if (discountData.type === 'fixed') {
      discountAmount = Math.min(discountData.value, subtotal);
    }

    setCartDiscount({
      ...discountData,
      amount: Math.round(discountAmount * 100) / 100
    });
  };

  const applyItemDiscount = (productId, discountData) => {
    // discountData: {type: 'percentage'|'fixed', value: number, reason: string}
    const item = cart.find(i => i.product_id === productId);
    if (!item) return;

    const itemSubtotal = item.price * item.quantity;
    let discountAmount = 0;

    if (discountData.type === 'percentage') {
      discountAmount = itemSubtotal * (discountData.value / 100);
    } else if (discountData.type === 'fixed') {
      discountAmount = Math.min(discountData.value, itemSubtotal);
    }

    setItemDiscounts(prev => ({
      ...prev,
      [productId]: {
        ...discountData,
        amount: Math.round(discountAmount * 100) / 100
      }
    }));
  };

  const removeCartDiscount = () => {
    setCartDiscount(null);
  };

  const removeItemDiscount = (productId) => {
    setItemDiscounts(prev => {
      const newDiscounts = { ...prev };
      delete newDiscounts[productId];
      return newDiscounts;
    });
  };

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getTotalDiscount = () => {
    // Calculate total discount from both cart and item discounts
    let total = 0;

    // Add item discounts
    Object.values(itemDiscounts).forEach(discount => {
      total += discount.amount;
    });

    // Add cart discount
    if (cartDiscount) {
      total += cartDiscount.amount;
    }

    return total;
  };

  const getCartTotal = () => {
    const subtotal = getSubtotal();
    const discount = getTotalDiscount();
    return Math.max(0, subtotal - discount);
  };

  const getItemCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const value = {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getItemCount,
    // Discount functions
    cartDiscount,
    itemDiscounts,
    applyCartDiscount,
    applyItemDiscount,
    removeCartDiscount,
    removeItemDiscount,
    getSubtotal,
    getTotalDiscount
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
