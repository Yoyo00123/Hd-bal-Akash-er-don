const axios = require("axios");

// API URL
const API_URL = "https://akash-balance-bot.vercel.app";

// 🔹 Get balance
async function getBalance(userID) {
  try {
    const res = await axios.get(`${API_URL}/api/balance/${userID}`);
    console.log("Get balance response:", res.data);
    return res.data.balance || 100;
  } catch (error) {
    console.error("Get balance error:", error.message);
    return 100;
  }
}

// 🔹 Subtract balance (Instead of lose)
async function subtractBalance(userID, amount) {
  try {
    const res = await axios.post(`${API_URL}/api/balance/subtract`, { 
      userId: userID,
      amount: amount 
    }, { timeout: 10000 });
    
    console.log("Subtract response:", res.data);
    
    if (res.data.success) {
      return res.data.balance;
    }
    return null;
  } catch (error) {
    console.error("Subtract error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return null;
  }
}

// 🔹 Add balance (Instead of win)
async function addBalance(userID, amount) {
  try {
    const res = await axios.post(`${API_URL}/api/balance/add`, { 
      userId: userID,
      amount: amount 
    }, { timeout: 10000 });
    
    console.log("Add balance response:", res.data);
    
    if (res.data.success) {
      return res.data.balance;
    }
    return null;
  } catch (error) {
    console.error("Add balance error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
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
    name: "spin",
    aliases: ["bet", "gamble", "slot"],
    version: "6.0",
    author: "MOHAMMAD AKASH",
    countDown: 5,
    role: 0,
    description: "Spin and win/loss money.",
    category: "economy",
    guide: {
      en: "{p}spin <amount>\n{p}spin all"
    }
  },

  onStart: async function ({ message, event, args, usersData }) {
    const senderID = event.senderID;
    const subCommand = args[0]?.toLowerCase();

    // ✅ /spin all - Bet all balance
    if (subCommand === "all") {
      const balance = await getBalance(senderID);
      if (balance <= 0) {
        return message.reply("❌ You have no money to bet!");
      }
      return executeSpin(senderID, balance, message, usersData);
    }

    // ✅ /spin <amount>
    const betAmount = parseInt(subCommand);
    
    if (isNaN(betAmount) || betAmount <= 0) {
      return message.reply("❌ Usage:\n/spin <amount>\n/spin all\n\nExamples:\n/spin 100\n/spin all");
    }

    const balance = await getBalance(senderID);
    if (balance < betAmount) {
      return message.reply(`❌ Not enough money!\n💰 Your balance: ${formatBalance(balance)}\n🎯 Required: ${formatBalance(betAmount)}`);
    }

    return executeSpin(senderID, betAmount, message, usersData);
  }
};

// 🔹 Execute spin game
async function executeSpin(userID, betAmount, message, usersData) {
  try {
    console.log(`Starting spin for ${userID}, bet: ${betAmount}`);
    
    // Deduct bet first using SUBTRACT endpoint
    console.log("Subtracting bet amount...");
    const afterBetBalance = await subtractBalance(userID, betAmount);
    
    if (afterBetBalance === null) {
      console.log("Subtract failed!");
      return message.reply("❌ Failed to place bet. API error.");
    }
    
    console.log("After bet balance:", afterBetBalance);

    // Generate random slot symbols
    const symbols = ["🍒", "🍋", "🍊", "🍇", "🔔", "⭐", "7️⃣", "💎"];
    const reels = [];
    
    for (let i = 0; i < 3; i++) {
      reels.push(symbols[Math.floor(Math.random() * symbols.length)]);
    }
    
    // Calculate win multiplier
    let multiplier = 0;
    let resultText = "";
    
    // Check for wins
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      // Three of a kind
      if (reels[0] === "💎") multiplier = 10;
      else if (reels[0] === "7️⃣") multiplier = 8;
      else if (reels[0] === "⭐") multiplier = 6;
      else multiplier = 4;
      resultText = "🎰 **JACKPOT!** 🎰";
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      // Two of a kind
      multiplier = 2;
      resultText = "🎰 **WINNER!** 🎰";
    } else {
      // No win
      multiplier = 0;
      resultText = "🎰 **TRY AGAIN** 🎰";
    }
    
    // Calculate win amount
    const winAmount = Math.floor(betAmount * multiplier);
    let newBalance = afterBetBalance;
    
    // Add winnings if any
    if (winAmount > 0) {
      console.log("Adding winnings:", winAmount);
      newBalance = await addBalance(userID, winAmount);
      if (newBalance === null) {
        newBalance = afterBetBalance + winAmount;
      }
    }
    
    console.log("Final balance:", newBalance);
    
    // Get user name
    let userName = `Player`;
    try {
      if (usersData && typeof usersData.getName === 'function') {
        userName = await usersData.getName(userID) || userName;
      }
    } catch (e) {}
    
    // Create result message
    const slotDisplay = `[ ${reels[0]} | ${reels[1]} | ${reels[2]} ]`;
    
    let resultMessage = `${resultText}\n\n`;
    resultMessage += `👤 **Player:** ${userName}\n`;
    resultMessage += `🎰 **Slots:** ${slotDisplay}\n`;
    resultMessage += `💰 **Bet:** ${formatBalance(betAmount)}\n`;
    
    if (multiplier > 0) {
      resultMessage += `✨ **Multiplier:** ${multiplier}x\n`;
      resultMessage += `🏆 **Won:** ${formatBalance(winAmount)}\n`;
    } else {
      resultMessage += `😞 **Lost:** ${formatBalance(betAmount)}\n`;
    }
    
    resultMessage += `💵 **Balance:** ${formatBalance(newBalance)}\n`;
    
    // Add message based on result
    if (multiplier >= 4) {
      resultMessage += `\n🔥 **HUGE WIN!** Congratulations!`;
    } else if (multiplier > 0) {
      resultMessage += `\n🎉 **Nice win!**`;
    } else {
      resultMessage += `\n💪 Better luck next time!`;
    }
    
    // Send result
    await message.reply(resultMessage);
    
  } catch (error) {
    console.error("Spin game error:", error);
    message.reply("❌ Game error. Please try again later.");
  }
}
