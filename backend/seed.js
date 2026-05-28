require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Complaint = require("./models/Complaint");

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // 1. Create Admin User
    const adminUsername = "admin";
    const existingAdmin = await User.findOne({ username: adminUsername });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const adminUser = new User({
        username: adminUsername,
        password: hashedPassword,
        role: "admin",
        email: "admin@seva.ai",
        phone: "0000000000",
        fullName: "System Administrator",
      });
      await adminUser.save();
      console.log("Admin user created successfully.");
    } else {
      console.log("Admin user already exists. Skipping creation.");
    }

    // 2. Create sample complaints
    console.log("Creating sample complaints...");
    
    const sampleComplaints = [
      {
        rawText: "There is a huge pothole on Main Street near the central park causing traffic jams.",
        refinedText: "Large pothole on Main Street near Central Park causing traffic disruption.",
        department: "road",
        location: "Main Street, Central Park area",
        priority: "High",
        status: "pending"
      },
      {
        rawText: "A water pipe has burst near the community center, wasting a lot of water.",
        refinedText: "Burst water pipe near the community center resulting in water wastage.",
        department: "water",
        location: "Community Center",
        priority: "High",
        status: "assigned"
      },
      {
        rawText: "The street lights in sector 4 are not working for the last 3 days.",
        refinedText: "Street lights non-functional in Sector 4 for 3 consecutive days.",
        department: "electricity",
        location: "Sector 4",
        priority: "Medium",
        status: "pending"
      },
      {
        rawText: "Garbage has not been collected from the residential block for a week.",
        refinedText: "Uncollected garbage in residential block for 7 days.",
        department: "waste",
        location: "Residential Block B",
        priority: "Low",
        status: "in-progress"
      },
      {
        rawText: "The drainage system is overflowing after the recent rain on 5th avenue.",
        refinedText: "Overflowing drainage system post-rain on 5th Avenue.",
        department: "drainage",
        location: "5th Avenue",
        priority: "Medium",
        status: "pending"
      }
    ];

    for (const comp of sampleComplaints) {
      const base = Date.now().toString(36).toUpperCase();
      comp.ticketId = `CMP-${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const complaint = new Complaint(comp);
      await complaint.save();
    }
    
    console.log(`Successfully added ${sampleComplaints.length} sample complaints.`);
    
    console.log("Database seeding completed.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
