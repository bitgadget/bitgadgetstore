import type { Express } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export function setupAuthRoutes(app: Express) {
  // Registrazione utente
  app.post("/api/auth/register", async (req, res) => {
    try {
      console.log("Registration attempt:", req.body);
      
      const { username, email, password, firstName, lastName } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ 
          message: "Username, email e password sono obbligatori" 
        });
      }
      
      // Controlla se l'utente esiste già
      const [existingUser] = await db.select().from(users).where(eq(users.email, email));
      if (existingUser) {
        return res.status(400).json({ 
          message: "Utente con questa email già esistente" 
        });
      }
      
      // Crea nuovo utente
      const [newUser] = await db.insert(users).values({
        username,
        email,
        password, // In produzione, hashare con bcrypt
        firstName: firstName || username,
        lastName: lastName || ''
      }).returning();
      
      // Rimuovi password dalla risposta
      const { password: _, ...userResponse } = newUser;
      
      console.log("User created successfully:", userResponse);
      
      res.status(201).json({
        message: "Utente creato con successo!",
        user: userResponse
      });
      
    } catch (error) {
      console.error('Errore registrazione:', error);
      res.status(500).json({ 
        message: "Registrazione fallita" 
      });
    }
  });

  // Login utente
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ 
          message: "Email e password sono obbligatori" 
        });
      }
      
      // Trova utente
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user || user.password !== password) {
        return res.status(401).json({ 
          message: "Credenziali non valide" 
        });
      }
      
      // Rimuovi password dalla risposta
      const { password: _, ...userResponse } = user;
      
      res.json({
        message: "Login effettuato con successo!",
        user: userResponse
      });
      
    } catch (error) {
      console.error('Errore login:', error);
      res.status(500).json({ 
        message: "Login fallito" 
      });
    }
  });

  // Ottieni utente corrente (mock per ora)
  app.get("/api/auth/user", (req, res) => {
    res.json({
      id: 1,
      username: "BitcoinUser",
      email: "user@bitgadget.com",
      firstName: "Bitcoin",
      lastName: "User"
    });
  });
}