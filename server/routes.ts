import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCartItemSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Get single product
  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Get cart items (using session-based cart)
  app.get("/api/cart", async (req, res) => {
    try {
      const sessionId = req.sessionID || "anonymous";
      const cartItems = await storage.getCartItems(sessionId);
      res.json(cartItems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cart items" });
    }
  });

  // Add item to cart
  app.post("/api/cart", async (req, res) => {
    try {
      const sessionId = req.sessionID || "anonymous";
      const validatedData = insertCartItemSchema.parse({
        ...req.body,
        sessionId
      });
      
      const cartItem = await storage.addToCart(validatedData);
      res.json(cartItem);
    } catch (error) {
      res.status(400).json({ message: "Invalid cart item data" });
    }
  });

  // Update cart item quantity
  app.patch("/api/cart/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity } = req.body;
      
      if (quantity <= 0) {
        await storage.removeFromCart(id);
        return res.json({ message: "Item removed from cart" });
      }
      
      const updatedItem = await storage.updateCartItem(id, quantity);
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Cart item not found" });
      }
      
      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  // Remove item from cart
  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.removeFromCart(id);
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove cart item" });
    }
  });

  // Clear entire cart
  app.delete("/api/cart", async (req, res) => {
    try {
      const sessionId = req.sessionID || "anonymous";
      await storage.clearCart(sessionId);
      res.json({ message: "Cart cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });

  // Real Bitcoin price from Kraken API (BTC/EUR direct)
  app.get("/api/bitcoin-price", async (req, res) => {
    try {
      // Fetch current Bitcoin price from Kraken using BTC/EUR pair directly
      const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTEUR');
      const data = await response.json();
      
      if (data.error && data.error.length > 0) {
        throw new Error('Kraken API error: ' + data.error.join(', '));
      }
      
      const ticker = data.result.XXBTZEUR;
      const currentPrice = parseFloat(ticker.c[0]); // Last trade price in EUR
      const openPrice = parseFloat(ticker.o); // Open price (24h ago) in EUR
      
      // Calculate 24h change percentage
      const change = ((currentPrice - openPrice) / openPrice) * 100;
      
      res.json({
        price: currentPrice,
        change: change,
        timestamp: new Date().toISOString(),
        volume: ticker.v[1], // 24h volume
        high: parseFloat(ticker.h[1]), // 24h high in EUR
        low: parseFloat(ticker.l[1]) // 24h low in EUR
      });
    } catch (error) {
      console.error('Error fetching Bitcoin price from Kraken:', error);
      res.status(500).json({ message: "Failed to fetch Bitcoin price from Kraken API" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
