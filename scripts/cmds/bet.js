const { MongoClient } = require('mongodb');

// 🔥 MongoDB Connection String
const MONGODB_URI = "mongodb+srv://akashbotdev_db_user:1uZAtAyVcXDV0tJc@balancebot.ihk6khc.mongodb.net/coinx?retryWrites=true&w=majority&appName=Balancebot";

let db;
let client;

// 🔹 MongoDB কানেক্ট করো
async function connectDB() {
  try {
    if (!client) {
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      db = client.db('coinx');
      console.log('✅ MongoDB Connected for Bet.js');
    }
    return true;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    return false;
  }
}

// 🔹 Get balance from MongoDB
async function getBalance(userID) {
  try {
    if (!db) await connectDB();
    
    const user = await db.collection('balances').findOne({ userID: userID });
    
    if (user) {
      return user.balance;
    }
    return 100; // Default balance
  } catch (error) {
    console.error('Get balance error:', error);
    return 100;
  }
}

// 🔹 Update balance in MongoDB - SIMPLE FIX
async function updateUserBalance(userID, changeAmount) {
  try {
    if (!db) await connectDB();
    
    // Find user first
    const user = await db.collection('balances').findOne({ userID: userID });
    let currentBalance = 100;
    
    if (user) {
      currentBalance = user.balance;
    } else {
      // Create new user
      await db.collection('balances').insertOne({
        userID: userID,
        balance: 100,
        createdAt: new Date()
      });
    }
    
    // Calculate new balance
    const newBalance = Math.max(0, currentBalance + changeAmount);
    
    // Update in database
    await db.collection('balances').updateOne(
      { userID: userID },
      { 
        $set: { 
          balance: newBalance,
          updatedAt: new Date() 
        }
      },
      { upsert: true }
    );
    
    return newBalance;
    
  } catch (error) {
    console.error('Update balance error:', error);
    return null;
  }
}

// 🔹 Format balance
function formatBalance(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toString();
}

module.exports = {
  config: {
    name: "bet",
    aliases: ["spin", "gamble"],
    version: "14.0",
    author: "MOHAMMAD AKASH",
    role: 0,
    description: "Bet and win money - MongoDB Fixed",
    category: "economy",
    guide: {
      en: "{p}bet <amount>"
    }
  },

  onStart: async function ({ message, event, args }) {
    const senderID = event.senderID;
    const betAmount = parseInt(args[0]);
    
    if (!betAmount || betAmount <= 0) {
      return message.reply("🎰 Usage: !bet <amount>\nExample: !bet 100");
    }

    try {
      // ১. Current balance check
      const currentBalance = await getBalance(senderID);
      
      if (currentBalance < betAmount) {
        return message.reply(
          `❌ Insufficient balance!\n💰 You have: ${formatBalance(currentBalance)} $\n🎯 Need: ${formatBalance(betAmount)} $`
        );
      }

      // ২. Game logic
      const random = Math.random();
      let multiplier = 0;
      let resultText = "";
      
      if (random < 0.40) {
        multiplier = 0;
        resultText = "💥 Lost!";
      } else if (random < 0.65) {
        multiplier = 1;
        resultText = "🟡 Break even!";
      } else if (random < 0.85) {
        multiplier = 2;
        resultText = "🟢 2x Win!";
      } else if (random < 0.95) {
        multiplier = 3;
        resultText = "🔥 3x Win!";
      } else {
        multiplier = 10;
        resultText = "🎉 JACKPOT 10x!";
      }

      const winAmount = betAmount * multiplier;
      let netChange = 0;
      
      // ৩. Calculate change
      if (multiplier === 0) {
        netChange = -betAmount; // Lost bet
      } else if (multiplier === 1) {
        netChange = 0; // Break even
      } else {
        netChange = winAmount - betAmount; // Win profit
      }

      // ৪. Update balance
      const newBalance = await updateUserBalance(senderID, netChange);
      
      // ৫. Send result
      const messageText = 
        `${resultText}\n\n` +
        `🎰 Bet: ${formatBalance(betAmount)} $\n` +
        `✨ Multiplier: ${multiplier}x\n` +
        `💰 Won: ${formatBalance(winAmount)} $\n` +
        `📈 Change: ${netChange >= 0 ? '+' : ''}${formatBalance(netChange)} $\n` +
        `💵 New Balance: ${formatBalance(newBalance)} $\n\n` +
        `✅ Balance updated in MongoDB!\n` +
        `📊 Check with: !balance`;
      
      await message.reply(messageText);
      
    } catch (error) {
      console.error("Bet error:", error);
      message.reply("❌ Game error. Try again.");
    }
  }
};
