const { createCanvas } = require('canvas');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

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
      console.log('✅ MongoDB Connected for Balance.js');
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

// 🔹 Transfer balance in MongoDB
async function transferBalance(senderID, receiverID, amount) {
  try {
    if (!db) await connectDB();
    
    const session = client.startSession();
    
    try {
      session.startTransaction();
      
      // Get or create sender
      let sender = await db.collection('balances').findOne({ userID: senderID }, { session });
      if (!sender) {
        await db.collection('balances').insertOne({
          userID: senderID,
          balance: 100,
          createdAt: new Date()
        }, { session });
        sender = { balance: 100 };
      }
      
      // Get or create receiver
      let receiver = await db.collection('balances').findOne({ userID: receiverID }, { session });
      if (!receiver) {
        await db.collection('balances').insertOne({
          userID: receiverID,
          balance: 100,
          createdAt: new Date()
        }, { session });
        receiver = { balance: 100 };
      }
      
      if (sender.balance < amount) {
        throw new Error('Insufficient balance');
      }
      
      // Update sender
      await db.collection('balances').updateOne(
        { userID: senderID },
        { $inc: { balance: -amount } },
        { session }
      );
      
      // Update receiver
      await db.collection('balances').updateOne(
        { userID: receiverID },
        { $inc: { balance: amount } },
        { session }
      );
      
      await session.commitTransaction();
      
      // Get updated balances
      const updatedSender = await db.collection('balances').findOne({ userID: senderID });
      const updatedReceiver = await db.collection('balances').findOne({ userID: receiverID });
      
      return {
        success: true,
        senderBalance: updatedSender.balance,
        receiverBalance: updatedReceiver.balance
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('Transfer error:', error.message);
    return { 
      success: false, 
      message: error.message || 'Transfer failed' 
    };
  }
}

// 🔹 Format balance
function formatBalance(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, "") + "B $";
  if (num >= 1e6) return (num / 1e6).toFixed(2).replace(/\.00$/, "") + "M $";
  if (num >= 1e3) return (num / 1e3).toFixed(2).replace(/\.00$/, "") + "K $";
  return num + " $";
}

// 🔹 Get card type
function getCardType(balance) {
  if (balance >= 1000000) return { type: "SAPPHIRE", color: "#0F52BA", level: 7 };
  if (balance >= 250000) return { type: "GOLD", color: "#FFD700", level: 6 };
  if (balance >= 100000) return { type: "SILVER", color: "#C0C0C0", level: 5 };
  if (balance >= 50000) return { type: "PLATINUM", color: "#E5E4E2", level: 4 };
  if (balance >= 10000) return { type: "CLASSIC", color: "#4169E1", level: 3 };
  return { type: "STANDARD", color: "#808080", level: 2 };
}

module.exports.config = {
  name: "balance",
  aliases: ["bal", "bank"],
  version: "15.0",
  author: "MOHAMMAD AKASH",
  countDown: 5,
  role: 0,
  shortDescription: "Bank Card with MongoDB",
  longDescription: "Check balance with bank card - Direct MongoDB",
  category: "economy",
  guide: { en: "{p}balance | {p}balance transfer @user <amount>" }
};

module.exports.onStart = async function ({ api, event, args, usersData }) {
  const { threadID, senderID, messageID, mentions } = event;

  // 💸 Transfer system
  if (args[0] && args[0].toLowerCase() === "transfer") {
    if (!mentions || Object.keys(mentions).length === 0) {
      return api.sendMessage("❌ Mention someone to transfer.", threadID, messageID);
    }
    const targetID = Object.keys(mentions)[0];
    const amount = parseFloat(args[1]);
    
    if (isNaN(amount) || amount <= 0) {
      return api.sendMessage("❌ Invalid amount.", threadID, messageID);
    }
    
    if (targetID === senderID) {
      return api.sendMessage("❌ You can't transfer to yourself.", threadID, messageID);
    }

    const transferResult = await transferBalance(senderID, targetID, amount);
    
    if (!transferResult.success) {
      return api.sendMessage(`❌ ${transferResult.message}`, threadID, messageID);
    }

    const senderName = await usersData.getName(senderID);
    const receiverName = await usersData.getName(targetID);
    
    return api.sendMessage(
      `✅ **Transfer Complete**\n\n` +
      `👤 From: ${senderName}\n` +
      `👥 To: ${receiverName}\n` +
      `💰 Amount: ${formatBalance(amount)}\n` +
      `📊 Your New Balance: ${formatBalance(transferResult.senderBalance)}\n` +
      `📈 Their New Balance: ${formatBalance(transferResult.receiverBalance)}\n\n` +
      `💾 **Database:** MongoDB Connected`,
      threadID, messageID
    );
  }

  try {
    // Get balance from MongoDB
    const balance = await getBalance(senderID);
    const userName = await usersData.getName(senderID);
    const cardInfo = getCardType(balance);

    const userIDStr = senderID.toString();
    const cardDigits = userIDStr.padStart(16, '0').slice(-16);
    const cardNumber = `${cardDigits.slice(0, 4)}  ${cardDigits.slice(4, 8)}  ${cardDigits.slice(8, 12)}  ${cardDigits.slice(12, 16)}`;
    const expiryDate = "12/28";
    const cvv = Math.floor(Math.random() * 900) + 100;

    // Canvas setup
    const width = 850;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Card
    ctx.fillStyle = '#111111';
    roundRect(ctx, 40, 30, width - 80, height - 60, 20, true);

    // Top Left: Bank Name
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText('GLOBAL BANK', 60, 70);

    // Card Number
    ctx.font = '28px "Courier New", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(cardNumber, 60, 120);

    // Card Type
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    roundRect(ctx, width - 200, 70, 140, 40, 8, true);
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = cardInfo.color;
    ctx.fillText(cardInfo.type, width - 190, 100);

    // Available Balance
    ctx.fillStyle = 'rgba(0, 212, 255, 0.15)';
    roundRect(ctx, width - 350, 120, 290, 90, 15, true);
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText('AVAILABLE BALANCE', width - 340, 150);

    const balanceText = formatBalance(balance);
    let fontSize = 38;
    if (balanceText.length > 12) fontSize = 32;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(balanceText, width - 340, 190);

    // Card Holder
    ctx.font = '18px Arial';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText('CARD HOLDER', 60, 180);

    ctx.font = 'bold 26px Arial';
    ctx.fillStyle = '#FFFFFF';
    let displayName = userName.toUpperCase();
    if (displayName.length > 20) displayName = displayName.substring(0, 20);
    ctx.fillText(displayName, 60, 210);

    // Valid Thru
    ctx.font = '18px Arial';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText('VALID THRU', 60, 260);
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(expiryDate, 60, 290);

    // CVV
    ctx.font = '18px Arial';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText('CVV', 200, 260);
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(cvv.toString(), 200, 290);

    // Authorized Signature
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(60, 320, 200, 25);
    ctx.font = 'italic 14px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('Authorized Signature', 70, 340);

    // Chip
    ctx.fillStyle = '#FFD700';
    roundRect(ctx, 60, 380, 70, 50, 6, true);
    ctx.fillStyle = '#B8860B';
    for (let i = 0; i < 3; i++) ctx.fillRect(65, 385 + i * 12, 60, 3);

    // Card Rank System
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('CARD RANK SYSTEM:', 60, 460);

    const ranks = ["STANDARD", "CLASSIC", "PLATINUM", "SILVER", "GOLD", "SAPPHIRE"];
    let rankX = 60;
    const rankY = 500;
    ctx.font = 'bold 18px Arial';
    for (let i = 0; i < ranks.length; i++) {
      const rank = ranks[i];
      ctx.fillStyle = (cardInfo.type === rank) ? '#00FF00' : '#666666';
      ctx.fillText(rank, rankX, rankY);
      rankX += 100;
    }

    // Database info
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#00FF00';
    ctx.fillText(`✅ MONGODB CONNECTED | Balance: ${balanceText}`, 60, 550);

    // Save and send
    const cacheDir = path.join(__dirname, 'cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const filePath = path.join(cacheDir, `card_${senderID}.png`);
    fs.writeFileSync(filePath, canvas.toBuffer('image/png'));

    await api.sendMessage({
      body: `🏦 **GLOBAL BANK**\n👤 ${userName}\n💰 Balance: ${formatBalance(balance)}\n📊 Card: ${cardInfo.type}\n💾 Database: MongoDB Connected ✅`,
      attachment: fs.createReadStream(filePath)
    }, threadID, messageID);
    
    setTimeout(() => { 
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } 
      catch (e) {} 
    }, 30000);

  } catch (err) {
    console.error(err);
    api.sendMessage("❌ Error generating card.", threadID, messageID);
  }
};

// 🔹 Rounded rectangle helper
function roundRect(ctx, x, y, w, h, r, fill = false, stroke = false) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
