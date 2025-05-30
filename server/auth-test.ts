// Test rapido per la registrazione utenti
import { storage } from "./storage";

async function testUserRegistration() {
  try {
    console.log("Testing user registration...");
    
    const testUser = {
      username: "testuser",
      email: "test@example.com", 
      password: "password123",
      firstName: "Test",
      lastName: "User"
    };
    
    console.log("Creating user:", testUser);
    const user = await storage.createUser(testUser);
    console.log("User created successfully:", user.id);
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testUserRegistration();