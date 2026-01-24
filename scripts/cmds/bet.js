const axios = require("axios");

const API_URL = "https://akash-balance-bot.vercel.app";

module.exports = {
  config: {
    name: "bet",
    aliases: ["spin", "gamble"],
    version: "9.0",
    author: "MOHAMMAD AKASH",
    role: 0,
    description: "Fixed bet game with proper balance updates",
    category: "economy",
    guide: {
      en: "{p}bet <amount>"
    }
  },

  onStart: async function ({ message, event, args }) {
    const senderID = event.senderID;
    const betAmount = parseInt(args[0]);
    
    if (!betAmount || betAmount <= 0) {
      return message.reply("❌ Usage: !bet <amount>\nExample: !bet 50");
    }

    try {
      console.log(`=== BET GAME START ===`);
      console.log(`User: ${senderID}, Bet: ${betAmount}`);
      
      // ১. Get current balance
      const balanceRes = await axios.get(`${API_URL}/api/balance/${senderID}`);
      const currentBalance = balanceRes.data.balance || 100;
      console.log(`Current Balance: ${currentBalance}`);
      
      if (currentBalance < betAmount) {
        return message.reply(`❌ Insufficient balance!\n💰 You have: ${currentBalance} $\n🎯 Need: ${betAmount} $`);
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
      
      console.log(`Random: ${rand}, Multiplier: ${multiplier}x`);
      
      const totalWin = betAmount * multiplier;
      console.log(`Total Win: ${totalWin}`);
      
      let netChange = 0;
      
      // ৩. Calculate net change
      if (multiplier === 0) {
        // Lose: betAmount হারালেন
        netChange = -betAmount;
        console.log(`Net Change: -${betAmount} (Lost bet)`);
      } else if (multiplier === 1) {
        // Break even: টাকা ফেরত
        netChange = 0;
        console.log(`Net Change: 0 (Break even)`);
      } else {
        // Win: (win - bet) = নেট লাভ
        netChange = totalWin - betAmount;
        console.log(`Net Change: +${netChange} (Won ${totalWin} - Bet ${betAmount})`);
      }
      
      // ৪. Update balance DIRECTLY
      let newBalance = currentBalance;
      
      if (netChange > 0) {
        // Win money
        console.log(`Adding ${netChange} to balance...`);
        const addRes = await axios.post(`${API_URL}/api/balance/add`, {
          userID: senderID,
          amount: netChange
        });
        newBalance = addRes.data.balance || currentBalance + netChange;
        console.log(`Add Response:`, addRes.data);
        
      } else if (netChange < 0) {
        // Lose money
        console.log(`Subtracting ${Math.abs(netChange)} from balance...`);
        const subRes = await axios.post(`${API_URL}/api/balance/subtract`, {
          userID: senderID,
          amount: Math.abs(netChange)
        });
        newBalance = subRes.data.balance || currentBalance + netChange;
        console.log(`Subtract Response:`, subRes.data);
      }
      
      console.log(`Final Balance: ${newBalance}`);
      
      // ৫. Send result
      const resultMessage = 
        `**${messageText}**\n\n` +
        `🎰 **Bet:** ${betAmount} $\n` +
        `✨ **Multiplier:** ${multiplier}x\n` +
        `💰 **Total Win:** ${totalWin} $\n` +
        `📈 **Net Change:** ${netChange >= 0 ? '+' : ''}${netChange} $\n` +
        `💵 **New Balance:** ${newBalance} $\n\n` +
        `✅ **Balance successfully updated!**\n` +
        `📊 Use \`!balance\` to see your updated bank card`;
      
      await message.reply(resultMessage);
      console.log(`=== BET GAME END ===\n`);
      
    } catch (error) {
      console.error("❌ Bet game error:", error.response?.data || error.message);
      message.reply("❌ Game error. Please try again later.");
    }
  }
};
