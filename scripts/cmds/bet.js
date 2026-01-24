const axios = require("axios");

// API URL
const API_URL = "https://akash-balance-bot.vercel.app";

// 🔹 Get balance - FIXED parameter
async function getBalance(userID) {
  try {
    const res = await axios.get(`${API_URL}/api/balance/${userID}`);
    return res.data.balance || 100;
  } catch {
    return 100;
  }
}

// 🔹 Win balance - FIXED parameter
async function winGame(userID, amount) {
  try {
    const res = await axios.post(`${API_URL}/api/balance/win`, { 
      userId: userID,  // ✅ Correct parameter name
      amount: amount 
    });
    return res.data.success ? res.data.balance : null;
  } catch (error) {
    console.error("Win game error:", error.response?.data || error.message);
    return null;
  }
}

// 🔹 Lose balance - FIXED parameter
async function loseGame(userID, amount) {
  try {
    const res = await axios.post(`${API_URL}/api/balance/lose`, { 
      userId: userID,  // ✅ Correct parameter name
      amount: amount 
    });
    return res.data.success ? res.data.balance : null;
  } catch (error) {
    console.error("Lose game error:", error.response?.data || error.message);
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

// 🔹 Get leaderboard from API
async function getLeaderboard() {
  try {
    const res = await axios.get(`${API_URL}/api/users`);
    if (res.data.success && res.data.users.length > 0) {
      return res.data.users
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10);
    }
    return [];
  } catch {
    return [];
  }
}

module.exports = {
  config: {
    name: "spin",
    aliases: ["bet", "gamble", "slot"],
    version: "5.0",
    author: "MOHAMMAD AKASH",
    countDown: 5,
    role: 0,
    description: "Spin and win/loss money. Use '/spin <amount>' or '/spin top'.",
    category: "economy",
    guide: {
      en: "{p}spin <amount>\n{p}spin top\n{p}spin all"
    }
  },

  onStart: async function ({ message, event, args, usersData }) {
    const senderID = event.senderID;
    const subCommand = args[0]?.toLowerCase();

    // ✅ /spin top - Leaderboard
    if (subCommand === "top") {
      try {
        const leaderboard = await getLeaderboard();
        
        if (leaderboard.length === 0) {
          return message.reply("🏆 No users found in the leaderboard.");
        }
        
        let leaderboardText = "🏆 **TOP 10 RICHEST PLAYERS** 🏆\n\n";
        
        for (let i = 0; i < leaderboard.length; i++) {
          const user = leaderboard[i];
          let medal = "";
          
          if (i === 0) medal = "🥇";
          else if (i === 1) medal = "🥈";
          else if (i === 2) medal = "🥉";
          else medal = `${i + 1}.`;
          
          // Get user name if possible
          let userName = `User ${user.userId.substring(0, 6)}`;
          try {
            if (usersData && typeof usersData.getName === 'function') {
              userName = await usersData.getName(user.userId) || userName;
            }
          } catch (e) {}
          
          leaderboardText += `${medal} ${userName} - ${formatBalance(user.balance)}\n`;
        }
        
        leaderboardText += `\n💰 Your rank: Checking...`;
        
        // Get user's rank
        const userBalance = await getBalance(senderID);
        const allUsers = await getLeaderboard();
        const userRank = allUsers.findIndex(u => u.userId === senderID) + 1;
        
        if (userRank > 0) {
          leaderboardText = leaderboardText.replace("Checking...", `#${userRank} with ${formatBalance(userBalance)}`);
        } else {
          leaderboardText = leaderboardText.replace("Checking...", `Not in top 10 (${formatBalance(userBalance)})`);
        }
        
        return message.reply(leaderboardText);
        
      } catch (error) {
        console.error("Leaderboard error:", error);
        return message.reply("❌ Could not fetch leaderboard.");
      }
    }
    
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
      return message.reply("❌ Usage:\n/spin <amount>\n/spin all\n/spin top\n\nExamples:\n/spin 100\n/spin all\n/spin top");
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
    // Deduct bet first
    const afterBetBalance = await loseGame(userID, betAmount);
    if (afterBetBalance === null) {
      return message.reply("❌ Failed to place bet. Try again.");
    }

    // Generate random slot symbols
    const symbols = ["🍒", "🍋", "🍊", "🍇", "🔔", "⭐", "7️⃣", "💎"];
    const reels = [];
    
    for (let i = 0; i < 3; i++) {
      reels.push(symbols[Math.floor(Math.random() * symbols.length)]);
    }
    
    // Calculate win multiplier based on symbols
    let multiplier = 0;
    let resultText = "";
    
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      // Three of a kind
      if (reels[0] === "💎") {
        multiplier = 50; // Diamond jackpot
        resultText = "🎰 **DIAMOND JACKPOT!** 🎰";
      } else if (reels[0] === "7️⃣") {
        multiplier = 20; // Triple 7
        resultText = "🎰 **TRIPLE 7!** 🎰";
      } else if (reels[0] === "⭐") {
        multiplier = 10; // Triple star
        resultText = "🎰 **TRIPLE STAR!** 🎰";
      } else {
        multiplier = 5; // Other triple
        resultText = "🎰 **TRIPLE MATCH!** 🎰";
      }
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      // Two of a kind
      multiplier = 2;
      resultText = "🎰 **DOUBLE MATCH!** 🎰";
    } else if (reels.includes("💎") && reels.includes("⭐") && reels.includes("7️⃣")) {
      // Special combination
      multiplier = 15;
      resultText = "🎰 **SPECIAL COMBO!** 🎰";
    } else {
      // No win
      multiplier = 0;
      resultText = "🎰 **NO WIN** 🎰";
    }
    
    // Calculate win amount
    const winAmount = Math.floor(betAmount * multiplier);
    let newBalance = afterBetBalance;
    
    // Add winnings if any
    if (winAmount > 0) {
      newBalance = await winGame(userID, winAmount);
      if (newBalance === null) {
        newBalance = afterBetBalance + winAmount;
      }
    }
    
    // Get user name for display
    let userName = `Player`;
    try {
      if (usersData && typeof usersData.getName === 'function') {
        userName = await usersData.getName(userID) || userName;
      }
    } catch (e) {}
    
    // Create result message
    const slotDisplay = `[ ${reels[0]} | ${reels[1]} | ${reels[2]} ]`;
    
    let resultMessage = `${resultText}\n\n`;
    resultMessage += `🎯 **Player:** ${userName}\n`;
    resultMessage += `🎰 **Slot:** ${slotDisplay}\n`;
    resultMessage += `💰 **Bet:** ${formatBalance(betAmount)}\n`;
    
    if (multiplier > 0) {
      resultMessage += `✨ **Multiplier:** ${multiplier}x\n`;
      resultMessage += `🏆 **Won:** ${formatBalance(winAmount)}\n`;
    } else {
      resultMessage += `😞 **Lost:** ${formatBalance(betAmount)}\n`;
    }
    
    resultMessage += `💵 **New Balance:** ${formatBalance(newBalance)}\n`;
    
    // Add encouragement message
    if (multiplier >= 10) {
      resultMessage += `\n🔥 **AMAZING WIN!** You're on fire!`;
    } else if (multiplier >= 5) {
      resultMessage += `\n🎉 **GREAT WIN!** Keep it up!`;
    } else if (multiplier > 0) {
      resultMessage += `\n👍 **Good win!** Try again!`;
    } else {
      const encouragement = [
        "Better luck next time! 💪",
        "Don't give up! 🍀",
        "Try again, you might win big! 🎯",
        "Fortune favors the bold! ⚡"
      ];
      resultMessage += `\n${encouragement[Math.floor(Math.random() * encouragement.length)]}`;
    }
    
    // Send result
    await message.reply(resultMessage);
    
    // Special announcement for big wins
    if (winAmount >= betAmount * 10) {
      setTimeout(() => {
        message.reply(`🎊 **BIG WIN ALERT!** 🎊\n${userName} just won ${formatBalance(winAmount)} on the slots!`);
      }, 1000);
    }
    
  } catch (error) {
    console.error("Spin game error:", error);
    message.reply("❌ An error occurred while processing your spin. Please try again.");
  }
}
