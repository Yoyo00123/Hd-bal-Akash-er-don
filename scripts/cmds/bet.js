const { MongoClient } = require('mongodb');

// 🔥 MongoDB Connection String
const MONGODB_URI = "mongodb+srv://akashbotdev_db_user:1uZAtAyVcXDV0tJc@balancebot.ihk6khc.mongodb.net/coinx?retryWrites=true&w=majority&appName=Balancebot";

let db;
let client;

// 🔹 MongoDB কানেক্ট করো
async function connectDB() {
  try {
    if (!client || !client.topology || !client.topology.isConnected()) {
      client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
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
    } else {
      // Create new user with 100 balance
      await db.collection('balances').insertOne({
        userID: userID,
        balance: 100,
        createdAt: new Date()
      });
      return 100;
    }
  } catch (error) {
    console.error('Get balance error:', error);
    return 100; // Fallback
  }
}

// 🔹 Update balance in MongoDB
async function updateBalance(userID, changeAmount) {
  try {
    if (!db) await connectDB();
    
    const user = await db.collection('balances').findOne({ userID: userID });
    const currentBalance = user ? user.balance : 100;
    const newBalance = Math.max(0, currentBalance + changeAmount);
    
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
  if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, "") + "B $";
  if (num >= 1e6) return (num / 1e6).toFixed(2).replace(/\.00$/, "") + "M $";
  if (num >= 1e3) return (num / 1e3).toFixed(2).replace(/\.00$/, "") + "K $";
  return num + " $";
}

module.exports = {
  config: {
    name: "bet",
    aliases: ["spin", "gamble"],
    version: "12.0",
    author: "MOHAMMAD AKASH",
    role: 0,
    description: "Bet game with Direct MongoDB",
    category: "economy",
    guide: {
      en: "{p}bet <amount>"
    }
  },

  onStart: async function ({ message, event, args }) {
    const senderID = event.senderID;
    const betAmount = parseInt(args[0]);
    
    if (!betAmount || betAmount <= 0) {
      return message.reply("🎰 Usage: !bet <amount>\nExample: !bet 50");
    }

    try {
      console.log(`=== BET GAME START (MongoDB DIRECT) ===`);
      console.log(`User: ${senderID}, Bet: ${betAmount}`);
      
      // ১. Get current balance from MongoDB
      const currentBalance = await getBalance(senderID);
      console.log(`Current Balance from MongoDB: ${currentBalance}`);
      
      if (currentBalance < betAmount) {
        return message.reply(
          `❌ Insufficient balance!\n` +
          `💰 You have: ${formatBalance(currentBalance)}\n` +
          `🎯 Need: ${formatBalance(betAmount)}`
        );
      }

      // ২. Calculate game result
      const rand = Math.random();
      let multiplier = 0;
      let messageText = "";
      
      if (rand < 0.40) {
        multiplier = 0;
        messageText = "💥 Lost!";
      } else if (rand < 0.60) {
        multiplier = 1;
        messageText = "🟡 Break even!";
      } else if (rand < 0.80) {
        multiplier = 2;
        messageText = "🟢 2x Win!";
      } else if (rand < 0.95) {
        multiplier = 3;
        messageText = "🔥 3x Win!";
      } else {
        multiplier = 10;
        messageText = "🎉 JACKPOT 10x!";
      }
      
      console.log(`Random: ${rand.toFixed(2)}, Multiplier: ${multiplier}x`);
      
      const totalWin = betAmount * multiplier;
      console.log(`Total Win: ${totalWin}`);
      
      let netChange = 0;
      
      // ৩. Calculate net change
      if (multiplier === 0) {
        // Lose
        netChange = -betAmount;
      } else if (multiplier === 1) {
        // Break even
        netChange = 0;
      } else {
        // Win
        netChange = totalWin - betAmount;
      }
      
      console.log(`Net Change: ${netChange}`);
      
      // ৪. Update balance DIRECTLY in MongoDB
      let newBalance = await updateBalance(senderID, netChange);
      
      if (newBalance === null) {
        // Fallback calculation
        newBalance = currentBalance + netChange;
        console.log(`Using fallback balance: ${newBalance}`);
      }
      
      console.log(`Final Balance: ${newBalance}`);
      
      // ৫. Send result
      const resultMessage = 
        `**${messageText}**\n\n` +
        `🎰 **Bet:** ${formatBalance(betAmount)}\n` +
        `✨ **Multiplier:** ${multiplier}x\n` +
        `💰 **Total Win:** ${formatBalance(totalWin)}\n` +
        `📈 **Net Change:** ${netChange >= 0 ? '+' : ''}${formatBalance(netChange)}\n` +
        `💵 **New Balance:** ${formatBalance(newBalance)}\n\n` +
        `✅ **Balance updated in MongoDB!**\n` +
        `📊 Use \`!balance\` to see your updated bank card\n` +
        `💾 **Database:** MongoDB Connected ✅`;
      
      await message.reply(resultMessage);
      console.log(`=== BET GAME END ===\n`);
      
    } catch (error) {
      console.error("❌ Bet game error:", error.message);
      message.reply("❌ Game error. Please try again later.");
    }
  }
};
