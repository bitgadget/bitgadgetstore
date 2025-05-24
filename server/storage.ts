import { users, products, cartItems, type User, type InsertUser, type Product, type InsertProduct, type CartItem, type InsertCartItem } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User methods (existing)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Product methods
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  
  // Cart methods
  getCartItems(sessionId: string): Promise<(CartItem & { product: Product })[]>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: number, quantity: number): Promise<CartItem | undefined>;
  removeFromCart(id: number): Promise<void>;
  clearCart(sessionId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values(insertProduct)
      .returning();
    return product;
  }

  async getCartItems(sessionId: string): Promise<(CartItem & { product: Product })[]> {
    const result = await db
      .select({
        id: cartItems.id,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        sessionId: cartItems.sessionId,
        product: products
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.sessionId, sessionId));
    
    return result;
  }

  async addToCart(insertCartItem: InsertCartItem): Promise<CartItem> {
    // Check if item already exists in cart
    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(
        eq(cartItems.sessionId, insertCartItem.sessionId) &&
        eq(cartItems.productId, insertCartItem.productId)
      );

    if (existingItem) {
      // Update quantity
      const [updatedItem] = await db
        .update(cartItems)
        .set({ quantity: existingItem.quantity + (insertCartItem.quantity || 1) })
        .where(eq(cartItems.id, existingItem.id))
        .returning();
      return updatedItem;
    } else {
      // Create new cart item
      const [cartItem] = await db
        .insert(cartItems)
        .values({
          ...insertCartItem,
          quantity: insertCartItem.quantity || 1
        })
        .returning();
      return cartItem;
    }
  }

  async updateCartItem(id: number, quantity: number): Promise<CartItem | undefined> {
    const [updatedItem] = await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, id))
      .returning();
    return updatedItem || undefined;
  }

  async removeFromCart(id: number): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(sessionId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
  }
}

// Initialize database with products
async function initializeDatabase() {
  try {
    // Check if products already exist
    const existingProducts = await db.select().from(products);
    
    if (existingProducts.length === 0) {
      const bitcoinProducts: InsertProduct[] = [
        {
          name: "BIT TICKER Bitcoin and Crypto TICKER PRICE",
          price: 299.99,
          description: "Real-time Bitcoin price display with LED matrix technology. Stay updated with the latest crypto prices in style.",
          image: "@assets/ChatGPTImage29apr2025_21_40_51 (1).webp",
          category: "electronics"
        },
        {
          name: "₿ BLACK Bitcoin T-Shirt",
          price: 29.99,
          description: "Premium black cotton tee with embroidered Bitcoin logo. Made from 100% organic cotton for maximum comfort.",
          image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          category: "apparel"
        },
        {
          name: "BitTRUST Bitcoin HODL T-Shirt",
          price: 34.99,
          description: "Express your diamond hands with this HODL design. Perfect for true Bitcoin believers and long-term investors.",
          image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          category: "apparel"
        },
        {
          name: "BitSIGN RGB LED",
          price: 149.99,
          description: "Programmable RGB LED Bitcoin sign with customizable colors and patterns. Perfect for your crypto cave setup.",
          image: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          category: "electronics"
        },
        {
          name: "NOTYOURS T-Shirt – Bitcoin Self-Custody",
          price: 32.99,
          description: "Not your keys, not your coins statement tee. Spread awareness about Bitcoin self-custody with style.",
          image: "https://images.unsplash.com/photo-1562157873-818bc0726f68?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          category: "apparel"
        },
        {
          name: "₿ BLACK HOODIE",
          price: 59.99,
          description: "Cozy black hoodie with embroidered Bitcoin symbol. Premium cotton blend for ultimate comfort and durability.",
          image: "https://images.unsplash.com/photo-1556821840-3a9fbc86339e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          category: "apparel"
        },
        {
          name: "BITRocket – Bitcoin Rocket",
          price: 89.99,
          description: "To the moon rocket collectible figure. Hand-crafted premium collectible for Bitcoin enthusiasts.",
          image: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          category: "collectibles"
        },
        {
          name: "TO THE MOON ₿ SIGN",
          price: 79.99,
          description: "Illuminated acrylic Bitcoin moon sign with LED backlighting. Perfect wall art for your Bitcoin space.",
          image: "https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          category: "art"
        },
        {
          name: "EmergencyPILL ₿ – Bitcoin Orange Pill Art",
          price: 24.99,
          description: "Orange pill emergency kit art piece. A humorous take on introducing friends and family to Bitcoin.",
          image: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          category: "art"
        },
        {
          name: "Genesis₿lock – Bitcoin Genesis Block Art",
          price: 199.99,
          description: "Framed Genesis Block artwork with timestamp. Commemorate the birth of Bitcoin with this historical piece.",
          image: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          category: "art"
        },
        {
          name: "Bitcoin Whitepaper Wall Art",
          price: 129.99,
          description: "Elegant framed Bitcoin whitepaper print. Display Satoshi's revolutionary document in premium quality.",
          image: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          category: "art"
        },
        {
          name: "₿itBailout Panel Bitcoin Art",
          price: 249.99,
          description: "Times bailout headline commemorative panel. Historic newspaper front page that inspired Bitcoin's genesis block.",
          image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0e0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          category: "art"
        }
      ];

      await db.insert(products).values(bitcoinProducts);
      console.log("Database initialized with Bitcoin products!");
    }
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

export const storage = new DatabaseStorage();

// Initialize database on startup
initializeDatabase();
