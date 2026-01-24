const axios = require("axios");

const API_URL = "https://akash-balance-bot.vercel.app";

module.exports = {
  config: {
    name: "bet",
    aliases: ["spin"],
    version: "8.0",
    author: "MOHAMMAD AKASH",
    role: 0,
    description: "Working bet game",
    category: "economy",
    guide: { en: "{p}bet <amount>" }
  },

  onStart: async function ({ message, event, args }) {
    const senderID = event.senderID;
    const betAmount = parseInt(args[0]);
    
    if (!betAmount || betAmount <= 0) {
      return message.reply("❌ Use: !bet 50");
    }

    try {
      // ১. Check balance
      const balanceRes = await axios.get(`${API_URL}/api/balance/${senderID}`);
      const currentBalance = balanceRes.data.balance || 100;
      
      if (currentBalance < betAmount) {
        return message.reply(`❌ Not enough! Balance: ${currentBalance}`);
      }

      // ২. Game result
      const rand = Math.random();
      let multiplier = 0;
      let messageText = "💥 Lost!";
      
      if (rand < 0.4) multiplier = 0;      // 40% lose
      else if (rand < 0.6) multiplier = 1;  // 20% break even
      else if (rand < 0.8) multiplier = 2;  // 20% 2x
      else if (rand < 0.95) multiplier = 3; // 15% 3x
      else multiplier = 10;                // 5% 10x
      
      if (multiplier === 1) messageText = "🟡 Break even!";
      if (multiplier === 2) messageText = "🟢 2x Win!";
      if (multiplier === 3) messageText = "🔥 3x Win!";
      if (multiplier === 10) messageText = "🎉 JACKPOT 10x!";

      const winAmount = betAmount * multiplier;
      
      // ৩. Update balance based on result
      if (multiplier === 0) {
        // Just subtract bet amount
        await axios.post(`${API_URL}/api/balance/subtract`, {
          userID: senderID,
          amount: betAmount
        });
      } else if (multiplier === 1) {
        // Break even - no change needed
      } else {
        // Win - subtract bet, add winnings
        await axios.post(`${API_URL}/api/balance/add`, {
          userID: senderID,
          amount: winAmount - betAmount
        });
      }

      // ৪. Get updated balance
      const updatedRes = await axios.get(`${API_URL}/api/balance/${senderID}`);
      const newBalance = updatedRes.data.balance || currentBalance;
      
      // ৫. Send result
      message.reply(
        `${messageText}\n\n` +
        `🎰 Bet: ${betAmount} $\n` +
        `💰 Result: ${multiplier === 0 ? "Lost " + betAmount : "Won " + winAmount} $\n` +
        `💵 Balance: ${newBalance} $\n\n` +
        `✅ Balance updated!`
      );
      
    } catch (error) {
      console.error("Bet error:", error);
      message.reply("❌ Game error. Try again.");
    }
  }
};
