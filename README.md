# Sapiens.io - Server / Backend

**Sapiens.io Backend** provides the API and database layer for the Sapiens.io platform, handling user authentication, life lessons management, payment processing, and admin moderation. This backend ensures secure, reliable, and scalable operations for the frontend client.  

---

## ✨ Key Features

- **Lesson Management**: Create, read, update, and delete lessons; support for public, private, and premium lessons.  
- **Favorites & Likes**: Manage favorites.  
- **Admin Tools**: Manage users, lessons, and reported content.  
- **Payment Integration**: Stripe checkout for premium subscription, webhook integration, and MongoDB sync.  
- **Moderation & Reporting**: Handle reported lessons and inappropriate content.  

---

## 🛠 Tech Stack

- **Node.js & Express.js** - Backend server and routing  
- **MongoDB** - NoSQL database for users, lessons, and reports  
- **CORS** - Cross-Origin Resource Sharing configuration  
- **dotenv** - Environment variable management  
- **Stripe** - Payment processing integration  


---

## 👤 Author

**Md. Shuvo Al Shaied**  
- Email: shuvoalshaied@gmail.com  
- GitHub: [shuvoalshaied](https://github.com/wp-shuvo)  

---

## 📄 API Overview

### **Users**
- **POST /register** → Register a new user  
- **POST /login** → Login existing user  
- **GET /users** → Get all users (Admin only)  
- **PATCH /users/:id** → Update user role/profile  
- **DELETE /users/:id** → Delete user (Admin only)  

### **Lessons**
- **POST /lessons** → Add a new lesson  
- **GET /lessons** → Get all lessons (filter by public/private/premium)  
- **GET /lessons/:id** → Get lesson details  
- **PATCH /lessons/:id** → Update a lesson  
- **DELETE /lessons/:id** → Delete a lesson  
- **PATCH /lessons/:id/like** → Like/unlike a lesson  
- **PATCH /lessons/:id/favorite** → Add/remove from favorites  

### **Reports**
- **POST /lessons/reports** → Report a lesson  
- **GET /lessons/reports** → Admin view of reported lessons  

### **Payments**
- **POST /create-checkout-session** → Create Stripe checkout session  
- **PATCH** → Stripe to update `isPremium` status  

---

This backend is fully connected with the Sapiens.io client and provides secure, reliable endpoints for managing life lessons, user interactions, and payments.  

