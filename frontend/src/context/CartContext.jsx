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
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
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
    getItemCount
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
