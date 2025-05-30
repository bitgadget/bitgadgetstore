import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import Stripe from "stripe";

// Initialize Stripe (will work when keys are provided)
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Registration endpoint
  app.post("/api/auth/register", async (req, res) => {
    console.log("Registration request received:", req.body);
    
    const { username, email, password, firstName, lastName } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: "Username, email e password sono obbligatori" 
      });
    }
    
    try {
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ 
          message: "Utente con questa email già esistente" 
        });
      }
      
      // Create new user using database storage
      const newUser = await storage.createUser({
        username,
        email,
        password, // Password hashing is handled in storage layer
        firstName: firstName || username,
        lastName: lastName || ""
      });
      
      res.status(201).json({
        message: "Registrazione completata con successo!",
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ 
        message: "Errore durante la registrazione" 
      });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email e password sono obbligatori" 
      });
    }
    
    try {
      // Authenticate user using database storage
      const user = await storage.authenticateUser(email, password);
      if (!user) {
        return res.status(401).json({ 
          message: "Credenziali non valide" 
        });
      }
      
      // Create session in database
      const sessionToken = generateSessionToken();
      await storage.createSession({
        sessionToken: sessionToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
      
      // Set session cookie
      res.cookie('sessionToken', sessionToken, { 
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      res.json({
        message: "Login effettuato con successo!",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ 
        message: "Errore durante il login" 
      });
    }
  });

  // Get user endpoint
  app.get("/api/auth/user", async (req, res) => {
    console.log("Get user request - cookies:", req.cookies);
    
    const sessionToken = req.cookies?.sessionToken;
    
    if (!sessionToken) {
      console.log("No session token found");
      return res.status(401).json({ message: "Non autenticato" });
    }
    
    try {
      const session = await storage.getSession(sessionToken);
      if (!session) {
        console.log("No session found for token:", sessionToken);
        return res.status(401).json({ message: "Sessione non valida" });
      }
      
      const user = await storage.getUser(session.userId);
      if (!user) {
        console.log("No user found for session:", session.userId);
        return res.status(401).json({ message: "Utente non trovato" });
      }
      
      console.log("Found user:", user.username);
      
      // Prevent caching
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Errore del server" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", async (req, res) => {
    const sessionToken = req.cookies?.sessionToken;
    
    if (sessionToken) {
      try {
        await storage.deleteSession(sessionToken);
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
    
    res.clearCookie('sessionToken');
    res.json({ message: "Logout effettuato con successo!" });
  });

  // Products endpoints
  app.get("/api/products", async (req, res) => {
    try {
      const dbProducts = await storage.getAllProducts();
      
      // Transform database products to frontend format
      const frontendProducts = dbProducts.map(product => {
        const images = product.images || [product.image];
        console.log(`📸 Product ${product.id} (${product.name}): ${images.length} images:`, images);
        
        return {
          ...product,
          images: images,
          sizes: product.sizes || undefined,
          prices: product.prices || undefined,
          videoUrl: product.video || undefined,
          manual: product.manual || undefined
        };
      });
      
      console.log("🚀 Sending products to frontend:", frontendProducts.length);
      res.json(frontendProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products-old", (req, res) => {
    res.json([
      // Tech Gadgets - Dispositivi tecnologici Bitcoin
      {
        id: 1,
        name: "BIT TICKER – Bitcoin and Crypto TICKER PRICE",
        price: 79.99,
        description: "Transform your desk into a live crypto dashboard with BIT TRACKER, the sleek Wi-Fi connected display built for Bitcoin and cryptocurrency enthusiasts. No app required—see everything at a glance. You can also download the full user manual (PDF) from the product page.",
        image: "/attached_assets/ticker1.webp",
        category: "Tech Gadgets",
        images: [
          "/attached_assets/ticker1.webp",
          "/attached_assets/ticker2.webp",
          "/attached_assets/ticker3.webp"
        ],
        manual: "/attached_assets/Bit_Tracker_Manual (1).pdf"
      },
      {
        id: 2,
        name: "BitSIGN RGB LED",
        price: 129.99,
        description: "Illuminate your crypto setup with the ultimate Bitcoin LED sign! Vibrant RGB LED colors with remote control to change the colors of the led. Perfect for Bitcoin lovers & crypto influencers.",
        image: "/attached_assets/bitsign.webp",
        category: "Tech Gadgets",
        images: ["/attached_assets/bitsign.webp"],
        video: "/attached_assets/bitsign.mp4"
      },
      {
        id: 3,
        name: "BITRocket – Bitcoin Rocket",
        price: 49.99,
        description: "Bitcoin is going to the moon, and so is your desk setup! The BITRocket is a sleek, Bitcoin-themed rocket toy designed for traders and crypto lovers who believe in the future of BTC.",
        image: "/attached_assets/bitrocketorange.webp",
        category: "Tech Gadgets",
        images: [
          "/attached_assets/bitrocketorange.webp",
          "/attached_assets/bitrocketred.webp"
        ]
      },
      {
        id: 4,
        name: "TO THE MOON ₿ SIGN",
        price: 29.99,
        description: "Bitcoin is blasting off, and so is your desk setup! TO THE MOON SIGN is a bold, high-quality piece made from durable PLA. Designed for crypto enthusiasts, traders, miners, and HODLers.",
        image: "/attached_assets/tothemoon.webp",
        category: "Tech Gadgets",
        images: ["/attached_assets/tothemoon.webp"]
      },
      {
        id: 5,
        name: "EmergencyPILL ₿ – Bitcoin Orange Pill Art",
        price: 49.99,
        description: "Bitcoin is the escape. Take the Orange Pill! Limited-edition Bitcoin wall frame featuring mini-pill visuals with the message: 'In case of uncontrolled inflation, break the glass and take the orange pill.'",
        image: "/attached_assets/emergency1.webp",
        category: "Tech Gadgets",
        images: [
          "/attached_assets/emergency1.webp",
          "/attached_assets/emergency2.webp"
        ],
        video: "/attached_assets/emergencyvideo.mp4"
      },
      
      // Bitcoin Wear - Abbigliamento Bitcoin
      {
        id: 6,
        name: "₿ BLACK Bitcoin Hoodie",
        price: 50.00,
        description: "Premium black hoodie with exclusive Bitcoin logo design. High-quality cotton blend for maximum comfort and style.",
        image: "/attached_assets/20250331_2209_BlackHoodie_remix_01jqpx6adwfe4tt5nsepkqa8dh_6.webp",
        category: "Bitcoin Wear",
        images: [
          "/attached_assets/20250331_2209_BlackHoodie_remix_01jqpx6adwfe4tt5nsepkqa8dh_6.webp",
          "/attached_assets/black2.webp"
        ]
      },
      {
        id: 7,
        name: "₿ WHITE Bitcoin T-Shirt",
        price: 29.99,
        description: "Clean white Bitcoin t-shirt with minimalist design. Premium cotton blend for comfort and durability.",
        image: "/attached_assets/b.webp",
        category: "Bitcoin Wear",
        images: [
          "/attached_assets/b.webp",
          "/attached_assets/retrot.webp"
        ]
      },
      {
        id: 8,
        name: "BitTRUST Bitcoin HODL T-Shirt",
        price: 29.99,
        description: "HODL in style with the BitTRUST Bitcoin T-Shirt! High-quality cotton blend for comfort with bold Bitcoin design for true crypto believers.",
        image: "/attached_assets/dont1.webp",
        category: "Bitcoin Wear",
        images: [
          "/attached_assets/dont1.webp",
          "/attached_assets/retrot.webp"
        ]
      },
      {
        id: 9,
        name: "NOTYOURS T-Shirt – Bitcoin Self-Custody",
        price: 29.99,
        description: "'Not Your Keys, Not Your Coins' – Wear the Crypto Truth! The NOTYOURS Bitcoin T-Shirt is for those who understand the importance of self-custody and financial freedom.",
        image: "/attached_assets/notyour1.webp",
        category: "Bitcoin Wear",
        images: ["/attached_assets/notyour1.webp"]
      },

      // Bitcoin Art
      {
        id: 10,
        name: "Genesis Block Bitcoin Art",
        price: 30.00,
        sizes: ["30x30cm", "50x50cm"],
        prices: { "30x30cm": 30.00, "50x50cm": 50.00 },
        description: "Commemorate Bitcoin's birth with this stunning Genesis Block artwork. Features the original timestamp and tribute to Chancellor Alistair Darling. Perfect for any Bitcoin collector.",
        image: "/attached_assets/genesis.webp",
        category: "Bitcoin Art"
      },
      {
        id: 11,
        name: "Bitcoin Whitepaper Wall Art",
        price: 30.00,
        sizes: ["30x45cm", "50x70cm"],
        prices: { "30x45cm": 30.00, "50x70cm": 50.00 },
        description: "Display Satoshi's revolutionary Bitcoin whitepaper in elegant wall art form. High-quality print capturing the essence of the digital revolution.",
        image: "/attached_assets/whitepaper.webp",
        category: "Bitcoin Art"
      },
      {
        id: 12,
        name: "Bitcoin Chancellor Bailout Art",
        price: 199.99,
        description: "Historic Bitcoin Genesis Block tribute featuring the famous Chancellor headline. A must-have piece for serious Bitcoin historians and collectors.",
        image: "/attached_assets/cancellor.webp",
        category: "Bitcoin Art"
      }
    ]);
  });

  // Cart endpoints removed - using full implementation below

  // Bitcoin price endpoint
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
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching Bitcoin price from Kraken:', error);
      res.json({
        price: 95000,
        priceUSD: 104500, // Approximate USD fallback
        change: 0.5,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Simple in-memory cart storage
  const cartStore = new Map<string, Array<{id: number, productId: number, quantity: number}>>();
  let cartItemIdCounter = 1;

  // Get cart items
  app.get("/api/cart", async (req, res) => {
    const sessionId = (req.headers['x-session-id'] as string) || req.ip || "anonymous";
    const cartItems = cartStore.get(sessionId) || [];
    console.log("Getting cart for sessionId:", sessionId, "items:", cartItems.length);
    if (cartItems.length > 0) {
      console.log("Cart items details:", cartItems.map(item => ({ id: item.id, productId: item.productId, quantity: item.quantity })));
    }
    console.log("All cart sessions:", Array.from(cartStore.keys()));
    
    // Get products data
    const products = [
      // Tech Gadgets
      {
        id: 1,
        name: "BIT TICKER – Bitcoin and Crypto TICKER PRICE",
        price: 79.99,
        description: "Transform your desk into a live crypto dashboard with BIT TRACKER, the sleek Wi-Fi connected display built for Bitcoin and cryptocurrency enthusiasts. No app required—see everything at a glance. You can also download the full user manual (PDF) from the product page.",
        image: "/attached_assets/ticker1.webp",
        category: "Tech Gadgets"
      },
      {
        id: 2,
        name: "BitSIGN RGB LED",
        price: 129.99,
        description: "Illuminate your crypto setup with the ultimate Bitcoin LED sign! Vibrant RGB LED colors with remote control to change the colors of the led. Perfect for Bitcoin lovers & crypto influencers.",
        image: "/attached_assets/bitsign.webp",
        category: "Tech Gadgets"
      },
      {
        id: 3,
        name: "BITRocket – Bitcoin Rocket",
        price: 49.99,
        description: "Bitcoin is going to the moon, and so is your desk setup! The BITRocket is a sleek, Bitcoin-themed rocket toy designed for traders and crypto lovers who believe in the future of BTC.",
        image: "/attached_assets/bitrocketorange.webp",
        category: "Tech Gadgets"
      },
      {
        id: 4,
        name: "TO THE MOON ₿ SIGN",
        price: 29.99,
        description: "Bitcoin is blasting off, and so is your desk setup! TO THE MOON SIGN is a bold, high-quality piece made from durable PLA. Designed for crypto enthusiasts, traders, miners, and HODLers.",
        image: "/attached_assets/tothemoon.webp",
        category: "Tech Gadgets"
      },
      {
        id: 5,
        name: "EmergencyPILL – Bitcoin Emergency Kit",
        price: 49.99,
        description: "For when Bitcoin dips and you need emergency HODL strength! The EmergencyPILL is a fun, Bitcoin-themed stress relief item for crypto traders during market volatility.",
        image: "/attached_assets/emergency1.webp",
        category: "Tech Gadgets"
      },

      {
        id: 7,
        name: "Genesis Block T-Shirt",
        price: 29.99,
        description: "Celebrate Bitcoin's origin with this premium Genesis Block design t-shirt. Made from high-quality materials for ultimate comfort.",
        image: "/attached_assets/genesis.webp",
        category: "Bitcoin Wear"
      },
      {
        id: 8,
        name: "Bitcoin Whitepaper T-Shirt",
        price: 34.99,
        description: "The complete Bitcoin whitepaper printed on a premium quality t-shirt. A must-have for serious Bitcoin enthusiasts and historians.",
        image: "/attached_assets/whitepaper.webp",
        category: "Bitcoin Wear"
      },
      {
        id: 9,
        name: "NOTYOURS T-Shirt – Bitcoin Self-Custody",
        price: 34.99,
        description: "'Not Your Keys, Not Your Coins' – Wear the Crypto Truth! The NOTYOURS Bitcoin T-Shirt is for those who understand the importance of self-custody and financial freedom.",
        image: "/attached_assets/Hoodie_Front_1_3.webp",
        category: "Bitcoin Wear"
      },
      // Bitcoin Art
      {
        id: 10,
        name: "Genesis Block Bitcoin Art",
        price: 30.00,
        sizes: ["30x30cm", "50x50cm"],
        prices: { "30x30cm": 30.00, "50x50cm": 50.00 },
        description: "Commemorate Bitcoin's birth with this stunning Genesis Block artwork. Features the original timestamp and tribute to Chancellor Alistair Darling. Available in 30x30cm (€30) or 50x50cm (€50). Perfect for any Bitcoin collector.",
        image: "/attached_assets/genesis.webp",
        category: "Bitcoin Art"
      },
      {
        id: 11,
        name: "Bitcoin Whitepaper Wall Art",
        price: 30.00,
        sizes: ["30x45cm", "50x70cm"],
        prices: { "30x45cm": 30.00, "50x70cm": 50.00 },
        description: "Display Satoshi's revolutionary Bitcoin whitepaper in elegant wall art form. Available in 30x45cm (€30) or 50x70cm (€50). High-quality print capturing the essence of the digital revolution.",
        image: "/attached_assets/whitepaper.webp",
        category: "Bitcoin Art"
      },
      {
        id: 12,
        name: "Bitcoin Chancellor Bailout Art",
        price: 199.99,
        description: "Historic Bitcoin Genesis Block tribute featuring the famous Chancellor headline. A must-have piece for serious Bitcoin historians and collectors.",
        image: "/attached_assets/cancellor.webp",
        category: "Bitcoin Art"
      }
    ];
    
    // Enrich cart items with product data
    const enrichedCartItems = [];
    
    for (const cartItem of cartItems) {
      console.log("🔥 Processing cart item:", cartItem.id, "productId:", cartItem.productId, "quantity:", cartItem.quantity);
      
      if (cartItem.productId === 6) {
        console.log("🔥 Found BLACK Bitcoin Hoodie - adding to cart");
        const blackHoodie = {
          id: cartItem.id,
          productId: 6,
          quantity: cartItem.quantity,
          size: cartItem.size || null,
          sessionId,
          product: {
            id: 6,
            name: "₿ BLACK Bitcoin Hoodie", 
            price: 50.00,
            description: "Premium black hoodie with exclusive Bitcoin logo design. High-quality cotton blend for maximum comfort and style.",
            image: "/attached_assets/20250331_2209_BlackHoodie_remix_01jqpx6adwfe4tt5nsepkqa8dh_6.webp",
            category: "Bitcoin Wear",
            images: [
              "/attached_assets/20250331_2209_BlackHoodie_remix_01jqpx6adwfe4tt5nsepkqa8dh_6.webp",
              "/attached_assets/black2.webp"
            ]
          }
        };
        enrichedCartItems.push(blackHoodie);
        console.log("🔥 BLACK Bitcoin Hoodie added to enrichedCartItems");
      } else {
        // Get product from database
        const product = await storage.getProduct(cartItem.productId);
        if (product) {
          enrichedCartItems.push({
            id: cartItem.id,
            productId: cartItem.productId,
            quantity: cartItem.quantity,
            size: cartItem.size || null,
            sessionId,
            product: product
          });
          console.log(`🔥 Added product: ${product.name} - €${product.price}`);
        }
      }
    }
    
    console.log("🔥 Final enrichedCartItems count:", enrichedCartItems.length);

    res.json(enrichedCartItems);
  });

  // Add item to cart
  app.post("/api/cart", (req, res) => {
    console.log("🛒 POST /api/cart called!");
    const sessionId = (req.headers['x-session-id'] as string) || req.ip || "anonymous";
    const { productId, quantity = 1, size } = req.body;
    
    console.log("🛒 Adding to cart - sessionId:", sessionId, "productId:", productId, "quantity:", quantity);
    
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }
    
    let cartItems = cartStore.get(sessionId) || [];
    
    // Check if item already exists (same product and size)
    const parsedProductId = parseInt(productId);
    const existingItemIndex = cartItems.findIndex(item => 
      item.productId === parsedProductId && 
      (item.size || null) === (size || null)
    );
    
    if (existingItemIndex >= 0) {
      // Update quantity
      cartItems[existingItemIndex].quantity += parseInt(quantity);
    } else {
      // Add new item
      cartItems.push({
        id: cartItemIdCounter++,
        productId: parsedProductId,
        quantity: parseInt(quantity),
        size: size || null
      });
    }
    
    cartStore.set(sessionId, cartItems);
    console.log("Cart updated for sessionId:", sessionId, "total items:", cartItems.length);
    res.json({ message: "Item added to cart" });
  });

  // Update cart item quantity
  app.patch("/api/cart/:id", (req, res) => {
    const sessionId = req.headers['x-session-id'] || req.ip || "anonymous";
    const itemId = parseInt(req.params.id);
    const { quantity } = req.body;
    
    let cartItems = cartStore.get(sessionId) || [];
    const itemIndex = cartItems.findIndex(item => item.id === itemId);
    
    if (itemIndex >= 0) {
      if (quantity <= 0) {
        cartItems.splice(itemIndex, 1);
      } else {
        cartItems[itemIndex].quantity = quantity;
      }
      cartStore.set(sessionId, cartItems);
      res.json({ message: "Cart updated" });
    } else {
      res.status(404).json({ message: "Cart item not found" });
    }
  });

  // Remove item from cart
  app.delete("/api/cart/:id", (req, res) => {
    const sessionId = (req.headers['x-session-id'] as string) || req.ip || "anonymous";
    const itemId = parseInt(req.params.id);
    
    let cartItems = cartStore.get(sessionId) || [];
    const filteredItems = cartItems.filter(item => item.id !== itemId);
    
    cartStore.set(sessionId, filteredItems);
    res.json({ message: "Item removed from cart" });
  });

  // Clear cart
  app.delete("/api/cart", (req, res) => {
    const sessionId = (req.headers['x-session-id'] as string) || req.ip || "anonymous";
    cartStore.set(sessionId, []);
    res.json({ message: "Cart cleared" });
  });

  // Create Order endpoint
  app.post("/api/orders", async (req, res) => {
    try {
      const { items, shippingAddress, paymentMethod, total } = req.body;
      
      if (!items || !shippingAddress) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get authenticated user ID from session
      const sessionToken = req.cookies?.sessionToken;
      let userId = null;
      
      if (sessionToken) {
        const session = await storage.getSession(sessionToken);
        if (session?.userId) {
          userId = session.userId;
        }
      }
      
      // Require authentication for checkout
      if (!userId) {
        return res.status(401).json({ error: "Authentication required for checkout" });
      }

      // Create order in database
      const order = await storage.createOrder({
        userId: userId, // Use authenticated user ID
        totalEur: total,
        status: paymentMethod === 'bitcoin' ? 'pending' : 'pending',
        paymentMethod,
        shippingAddress: JSON.stringify(shippingAddress),
        items: JSON.stringify(items)
      });

      console.log(`📦 Order created: #${order.id} - €${total} - ${paymentMethod}`);

      // Prepare email data
      const emailData = {
        orderId: order.id,
        customerEmail: shippingAddress.email,
        customerName: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
        items: items.map((item: any) => ({
          name: item.productName || 'Product',
          quantity: item.quantity,
          price: item.price,
          size: item.size
        })),
        total: total,
        shippingAddress: shippingAddress,
        paymentMethod: paymentMethod
      };

      // Send confirmation emails (async, don't wait)
      import('./email-service.js').then(({ sendOrderConfirmationEmail, sendAdminOrderNotification, sendBitcoinPaymentInstructions }) => {
        // Send customer confirmation
        sendOrderConfirmationEmail(emailData);
        
        // Send admin notification
        sendAdminOrderNotification(emailData);
        
        // If Bitcoin payment, send payment instructions
        if (paymentMethod === 'bitcoin') {
          // Generate a mock Bitcoin address for demo (in production, use a real Bitcoin wallet)
          const bitcoinAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
          const btcAmount = total / 95000; // Assuming current BTC price of €95,000
          sendBitcoinPaymentInstructions(emailData, bitcoinAddress, btcAmount);
        }
      }).catch(err => {
        console.error('Email service error:', err);
      });

      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Get Order endpoint
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Parse shipping address and items
      const orderWithDetails = {
        ...order,
        shippingAddress: JSON.parse(order.shippingAddress),
        items: JSON.parse(order.items || '[]').map((item: any) => ({
          ...item,
          product: {
            id: item.productId,
            name: item.productName || 'Product',
            image: item.productImage || '/default-product.jpg'
          }
        }))
      };

      res.json(orderWithDetails);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // Gift Cards routes
  app.post("/api/gift-cards/create", async (req, res) => {
    console.log("🎁 Gift card creation request received:", req.body);
    try {
      const { amount, recipientName, recipientEmail, senderName, message, deliveryDate } = req.body;
      
      // Generate unique gift card code
      const generateCode = () => {
        return 'BTC-' + Math.random().toString(36).substr(2, 8).toUpperCase();
      };
      
      // Create gift card in database
      const giftCard = await storage.createGiftCard({
        code: generateCode(),
        amount,
        recipientName,
        recipientEmail,
        senderName,
        message: message || null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        isPaid: false,
      });

      if (!stripe) {
        return res.status(400).json({ 
          error: "Payment processing not configured. Please provide Stripe keys." 
        });
      }

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: `BitGadget Gift Card - €${amount}`,
                description: `Digital gift card for ${recipientName}`,
                images: ['https://bitgadget.replit.app/gift-card-image.jpg'],
              },
              unit_amount: amount * 100, // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${req.headers.origin}/gift-card-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/gift-cards`,
        metadata: {
          giftCardId: giftCard.id.toString(),
          type: 'gift_card',
        },
      });

      console.log(`🎁 Gift card created: ${giftCard.code} for €${amount}`);
      console.log(`🔗 Stripe checkout URL: ${session.url}`);
      
      res.json({ checkoutUrl: session.url });
    } catch (error) {
      console.error("❌ Error creating gift card:", error);
      console.error("Error details:", error.message);
      res.status(500).json({ message: "Failed to create gift card", error: error.message });
    }
  });

  app.get("/api/gift-cards/success", async (req, res) => {
    try {
      const sessionId = req.query.session_id as string;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Missing session ID" });
      }

      if (!stripe) {
        return res.status(400).json({ error: "Stripe not configured" });
      }

      // Retrieve the checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ message: "Payment not completed" });
      }

      const giftCardId = parseInt(session.metadata?.giftCardId || '0');
      
      // Update gift card payment status
      const updatedGiftCard = await storage.updateGiftCardPaymentStatus(
        giftCardId, 
        true, 
        session.payment_intent as string
      );

      if (!updatedGiftCard) {
        return res.status(404).json({ message: "Gift card not found" });
      }

      res.json({ giftCard: updatedGiftCard });
    } catch (error) {
      console.error("Error processing gift card success:", error);
      res.status(500).json({ message: "Failed to process gift card" });
    }
  });

  app.get("/api/admin/gift-cards", async (req, res) => {
    try {
      const giftCards = await storage.getAllGiftCards();
      res.json(giftCards);
    } catch (error) {
      console.error("Error fetching gift cards:", error);
      res.status(500).json({ message: "Failed to fetch gift cards" });
    }
  });

  // Stripe payment intent endpoint
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, orderId, metadata } = req.body;

      if (!stripe) {
        return res.status(400).json({ 
          error: "Payment processing not configured. Please provide Stripe keys." 
        });
      }

      // Convert EUR to cents for Stripe
      const amountInCents = Math.round(amount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "eur",
        metadata: {
          orderId: orderId?.toString() || '',
          ...metadata
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ 
        error: "Failed to create payment intent" 
      });
    }
  });

  // Stripe webhook endpoint (for handling payment confirmations)
  app.post('/api/stripe/webhook', async (req, res) => {
    try {
      if (!stripe) {
        return res.status(400).json({ error: "Stripe not configured" });
      }

      const sig = req.headers['stripe-signature'];
      let event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
      } catch (err) {
        console.log(`Webhook signature verification failed.`, err);
        return res.status(400).send(`Webhook Error: ${err}`);
      }

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          const orderId = paymentIntent.metadata.orderId;
          
          if (orderId) {
            // Update order status to paid
            await storage.updateOrderStatus(parseInt(orderId), 'paid');
            console.log(`💳 Payment confirmed for order #${orderId}`);
            
            // Here you could send confirmation email
            // await sendOrderConfirmationEmail(orderId);
          }
          break;
        
        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          const failedOrderId = failedPayment.metadata.orderId;
          
          if (failedOrderId) {
            await storage.updateOrderStatus(parseInt(failedOrderId), 'failed');
            console.log(`❌ Payment failed for order #${failedOrderId}`);
          }
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  });

  // Admin Analytics APIs
  app.get('/api/admin/stats', async (req, res) => {
    try {
      // Get total orders
      const totalOrders = await storage.getAllOrders();
      
      // Calculate total revenue
      const totalRevenue = totalOrders.reduce((sum, order) => sum + order.totalEur, 0);
      
      // Get total users
      const allUsers = await storage.getAllUsers();
      
      // Get all products
      const allProducts = await storage.getAllProducts();

      // Generate daily revenue data from real orders
      const dailyRevenue = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        const dateStr = date.toISOString().split('T')[0];
        
        // Filter orders for this date
        const dayOrders = totalOrders.filter(order => 
          order.createdAt?.toISOString().split('T')[0] === dateStr
        );
        
        return {
          date: dateStr,
          revenue: dayOrders.reduce((sum, order) => sum + order.totalEur, 0),
          orders: dayOrders.length
        };
      });

      // Calculate top products from real orders
      const productSales = new Map<string, { sales: number; revenue: number }>();
      totalOrders.forEach(order => {
        order.items?.forEach(item => {
          const key = item.product.name;
          if (!productSales.has(key)) {
            productSales.set(key, { sales: 0, revenue: 0 });
          }
          const current = productSales.get(key)!;
          current.sales += item.quantity;
          current.revenue += item.priceEur * item.quantity;
        });
      });

      const topProducts = Array.from(productSales.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Calculate category stats from real data
      const categoryStats = new Map<string, { count: number; revenue: number }>();
      allProducts.forEach(product => {
        const category = product.category;
        if (!categoryStats.has(category)) {
          categoryStats.set(category, { count: 0, revenue: 0 });
        }
        categoryStats.get(category)!.count += 1;
      });

      // Add revenue from real orders
      totalOrders.forEach(order => {
        order.items?.forEach(item => {
          const category = item.product.category;
          if (categoryStats.has(category)) {
            categoryStats.get(category)!.revenue += item.priceEur * item.quantity;
          }
        });
      });

      const categoryStatsArray = Array.from(categoryStats.entries())
        .map(([category, data]) => ({ category, ...data }));

      const stats = {
        totalOrders: totalOrders.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalProducts: allProducts.length,
        totalUsers: allUsers.length,
        dailyRevenue,
        topProducts,
        categoryStats: categoryStatsArray
      };

      res.json(stats);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ message: 'Errore nel caricamento delle statistiche' });
    }
  });

  // Update product inventory
  app.patch('/api/admin/products/:id/inventory', async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const { stock } = req.body;

      if (isNaN(productId) || stock < 0) {
        return res.status(400).json({ message: 'Dati non validi' });
      }

      const updatedProduct = await storage.updateProductStock(productId, stock);
      
      if (!updatedProduct) {
        return res.status(404).json({ message: 'Prodotto non trovato' });
      }

      res.json(updatedProduct);
    } catch (error) {
      console.error('Error updating product stock:', error);
      res.status(500).json({ message: 'Errore nell\'aggiornamento dell\'inventario' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}