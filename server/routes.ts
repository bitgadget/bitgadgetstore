import type { Express } from "express";
import { createServer, type Server } from "http";
import { insertCartItemSchema } from "@shared/schema";
import crypto from "crypto";
import { db } from "./db";
import { products, cartItems } from "@shared/schema";
import { eq } from "drizzle-orm";
import { setupAuthRoutes } from "./auth-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuthRoutes(app);

  // Get all products
  app.get("/api/products", async (req, res) => {
    try {
      const allProducts = await db.select().from(products);
      res.json(allProducts);
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

  // Registration endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password, firstName, lastName } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ 
          message: "Username, email and password are required" 
        });
      }
      
      // Check if user exists
      const [existingUser] = await db.select().from(users).where(eq(users.email, email));
      if (existingUser) {
        return res.status(400).json({ 
          message: "User with this email already exists" 
        });
      }
      
      // Create new user
      const [newUser] = await db.insert(users).values({
        username,
        email,
        password, // In production, hash this with bcrypt
        firstName: firstName || username,
        lastName: lastName || ''
      }).returning();
      
      // Remove password from response
      const { password: _, ...userResponse } = newUser;
      
      res.status(201).json({
        message: "User created successfully",
        user: userResponse
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ 
        message: "Registration failed" 
      });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      const user = await storage.authenticateUser(email, password);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Create session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await storage.createSession({
        userId: user.id,
        sessionToken,
        expiresAt
      });
      
      // Set secure cookie
      res.cookie('auth_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict'
      });
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ 
        message: "Login successful", 
        user: userWithoutPassword 
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const token = req.cookies.auth_token;
      if (token) {
        await storage.deleteSession(token);
      }
      
      res.clearCookie('auth_token');
      res.json({ message: "Logout successful" });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Get current user
  app.get("/api/auth/user", async (req, res) => {
    try {
      const token = req.cookies.auth_token;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const session = await storage.getSession(token);
      if (!session || session.expiresAt < new Date()) {
        res.clearCookie('auth_token');
        return res.status(401).json({ message: "Session expired" });
      }
      
      const user = await storage.getUser(session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Get user orders
  app.get("/api/orders", async (req, res) => {
    try {
      const token = req.cookies.auth_token;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const session = await storage.getSession(token);
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ message: "Session expired" });
      }
      
      const orders = await storage.getUserOrders(session.userId);
      res.json(orders);
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ message: "Failed to get orders" });
    }
  });

  // Real Bitcoin price from Kraken API (BTC/EUR and BTC/USD)
  app.get("/api/bitcoin-price", async (req, res) => {
    try {
      // Fetch both EUR and USD prices from Kraken
      const [eurResponse, usdResponse] = await Promise.all([
        fetch('https://api.kraken.com/0/public/Ticker?pair=XBTEUR'),
        fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD')
      ]);
      
      const eurData = await eurResponse.json();
      const usdData = await usdResponse.json();
      
      if (eurData.error && eurData.error.length > 0) {
        throw new Error('Kraken EUR API error: ' + eurData.error.join(', '));
      }
      
      if (usdData.error && usdData.error.length > 0) {
        throw new Error('Kraken USD API error: ' + usdData.error.join(', '));
      }
      
      const eurTicker = eurData.result.XXBTZEUR;
      const usdTicker = usdData.result.XXBTZUSD;
      
      const currentPriceEUR = parseFloat(eurTicker.c[0]); // Last trade price in EUR
      const currentPriceUSD = parseFloat(usdTicker.c[0]); // Last trade price in USD
      const openPriceEUR = parseFloat(eurTicker.o); // Open price (24h ago) in EUR
      
      // Calculate 24h change percentage using EUR
      const change = ((currentPriceEUR - openPriceEUR) / openPriceEUR) * 100;
      
      res.json({
        price: currentPriceEUR, // Keep EUR as primary
        priceUSD: currentPriceUSD, // Add real USD price
        change: change,
        timestamp: new Date().toISOString(),
        volume: eurTicker.v[1], // 24h volume
        high: parseFloat(eurTicker.h[1]), // 24h high in EUR
        low: parseFloat(eurTicker.l[1]) // 24h low in EUR
      });
    } catch (error) {
      console.error('Error fetching Bitcoin price from Kraken:', error);
      res.status(500).json({ message: "Failed to fetch Bitcoin price from Kraken API" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
