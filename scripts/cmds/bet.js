const axios = require("axios");

const API_URL = "https://akash-balance-bot.vercel.app";

// 🔹 Get balance
async function getBalance(userID) {
  try {
    const res = await axios.get(`${API_URL}/api/balance/${userID}`);
    return res.data.balance || 100;
  } catch (error) {
    console.error("Balance Error:", error.message);
    return 100;
  }
}

// 🔹 Add balance (use ADD endpoint instead of WIN)
async function addBalance(userID, amount) {
  try {
    const res = await axios.post(`${API_URL}/api/balance/add`, {
      userID: userID,
      amount: amount
    });
    console.log("Add Balance Response:", res.data);
    return res.data.balance;
  } catch (error) {
    console.error("Add Error:", error.message);
    return null;
  }
}

// 🔹 Subtract balance (use SUBTRACT endpoint instead of LOSE)
async function subtractBalance(userID, amount) {
  try {
    const res = await axios.post(`${API_URL}/api/balance/subtract`, {
      userID: userID,
      amount: amount
    });
    console.log("Subtract Balance Response:", res.data);
    return res.data.balance;
  } catch (error) {
    console.error("Subtract Error:", error.message);
    return null;
  }
}

module.exports = {
  config: {
    name: "bet",
    aliases: ["spin", "gamble"],
    version: "7.0",
    author: "MOHAMMAD AKASH",
    role: 0,
    description: "Bet game using ADD/SUBTRACT endpoints",
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

    // ১. Check current balance
    const currentBalance = await getBalance(senderID);
    
    if (currentBalance < betAmount) {
      return message.reply(`❌ Not enough money!\n💰 Your balance: ${currentBalance} $\n🎯 Required: ${betAmount} $`);
    }

    // ২. Subtract bet amount
    const afterBetBalance = await subtractBalance(senderID, betAmount);
    
    if (afterBetBalance === null) {
      return message.reply("❌ Failed to place bet. Try again.");
    }

    // ৩. Game logic
    const outcomes = [
      { text: "💥 You lost!", multiplier: 0, chance: 0.4 },      // 40%
      { text: "🟡 Break even!", multiplier: 1, chance: 0.2 },    // 20%
      { text: "🟢 2x Win!", multiplier: 2, chance: 0.2 },        // 20%
      { text: "🔥 3x Win!", multiplier: 3, chance: 0.15 },       // 15%
      { text: "🎉 10x JACKPOT!", multiplier: 10, chance: 0.05 }  // 5%
    ];

    const random = Math.random();
    let cumulative = 0;
    let outcome = outcomes[0];
    
    for (const opt of outcomes) {
      cumulative += opt.chance;
      if (random <= cumulative) {
        outcome = opt;
        break;
      }
    }

    const winAmount = Math.floor(betAmount * outcome.multiplier);
    let finalBalance = afterBetBalance;
    
    // ৪. Add winnings if won
    if (winAmount > 0) {
      finalBalance = await addBalance(senderID, winAmount);
      if (finalBalance === null) {
        finalBalance = afterBetBalance + winAmount;
      }
    }

    // ৫. Send result
    const resultMsg = 
      `${outcome.text}\n\n` +
      `🎰 Bet: ${betAmount} $\n` +
      `💰 Won: ${winAmount} $\n` +
      `💵 New Balance: ${finalBalance} $\n\n`;
      
    if (winAmount > 0) {
      message.reply(resultMsg + `✅ Balance updated successfully!`);
    } else {
      message.reply(resultMsg + `🔄 Use !balance to check your updated balance`);
    }
  }
};
