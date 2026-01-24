const axios = require("axios");

// API URL
const API_URL = "https://akash-balance-bot.vercel.app";

// 🔹 Get balance - FIXED
async function getBalance(userID) {
  try {
    const res = await axios.get(`${API_URL}/api/balance/${userID}`, { timeout: 10000 });
    console.log("Get Balance Response:", res.data);
    return res.data.balance || 100;
  } catch (error) {
    console.error("Get Balance Error:", error.message);
    return 100;
  }
}

// 🔹 Win balance - FIXED
async function winGame(userID, amount) {
  try {
    console.log(`Winning ${amount} for ${userID}`);
    const res = await axios.post(`${API_URL}/api/balance/win`, { 
      userID: userID,
      amount: amount 
    }, { timeout: 10000 });
    
    console.log("Win Game Response:", res.data);
    
    if (res.data.success) {
      return res.data.balance;
    } else {
      console.error("Win failed:", res.data.message);
      return null;
    }
  } catch (error) {
    console.error("Win Game API Error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return null;
  }
}

// 🔹 Lose balance - FIXED
async function loseGame(userID, amount) {
  try {
    console.log(`Losing ${amount} for ${userID}`);
    const res = await axios.post(`${API_URL}/api/balance/lose`, { 
      userID: userID,
      amount: amount 
    }, { timeout: 10000 });
    
    console.log("Lose Game Response:", res.data);
    
    if (res.data.success) {
      return res.data.balance;
    } else {
      console.error("Lose failed:", res.data.message);
      return null;
    }
  } catch (error) {
    console.error("Lose Game API Error:", {
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
    name: "bet",
    aliases: ["spin", "gamble"],
    version: "5.0",
    author: "MOHAMMAD AKASH",
    countDown: 5,
    role: 0,
    description: "Bet and win/loss money",
    category: "economy",
    guide: {
      en: "{p}bet <amount>"
    }
  },

  onStart: async function ({ message, event, args }) {
    const senderID = event.senderID;
    
    // ✅ /bet <amount>
    const betAmount = parseInt(args[0]);
    
    if (isNaN(betAmount) || betAmount <= 0) {
      return message.reply("❌ Usage: /bet <amount>\nExample: /bet 100");
    }

    // Check balance first
    const currentBalance = await getBalance(senderID);
    console.log(`Current balance for ${senderID}: ${currentBalance}`);
    
    if (currentBalance < betAmount) {
      return message.reply(`❌ Not enough money.\n💰 Your balance: ${formatBalance(currentBalance)} $`);
    }

    // Deduct bet first
    console.log("Deducting bet amount...");
    const afterBetBalance = await loseGame(senderID, betAmount);
    
    if (afterBetBalance === null) {
      return message.reply("❌ Failed to place bet. Try again.");
    }
    
    console.log(`After bet balance: ${afterBetBalance}`);

    // Outcomes with multipliers
    const outcomes = [
      { text: "💥 You lost everything!", multiplier: 0, chance: 0.3 },   // 30%
      { text: "😞 You got back half.", multiplier: 0.5, chance: 0.2 },   // 20%
      { text: "🟡 You broke even.", multiplier: 1, chance: 0.2 },        // 20%
      { text: "🟢 You doubled your money!", multiplier: 2, chance: 0.15 }, // 15%
      { text: "🔥 You tripled your bet!", multiplier: 3, chance: 0.1 },   // 10%
      { text: "🎉 JACKPOT! 10x reward!", multiplier: 10, chance: 0.05 }  // 5%
    ];

    // Calculate outcome based on chance
    const random = Math.random();
    let cumulativeChance = 0;
    let outcome = outcomes[0]; // Default
    
    for (const possibleOutcome of outcomes) {
      cumulativeChance += possibleOutcome.chance;
      if (random <= cumulativeChance) {
        outcome = possibleOutcome;
        break;
      }
    }

    const reward = Math.floor(betAmount * outcome.multiplier);
    let newBalance = afterBetBalance;
    
    // Add winnings if any
    if (reward > 0) {
      console.log(`Adding reward: ${reward}`);
      newBalance = await winGame(senderID, reward);
      
      if (newBalance === null) {
        // Fallback: manually calculate
        newBalance = afterBetBalance + reward;
        console.log(`Using fallback balance: ${newBalance}`);
      }
    }
    
    console.log(`Final balance: ${newBalance}`);

    // Send result
    return message.reply(
      `${outcome.text}\n` +
      `🎰 You bet: ${formatBalance(betAmount)}\n` +
      `💸 You won: ${formatBalance(reward)}\n` +
      `💰 New balance: ${formatBalance(newBalance)}`
    );
  }
};
