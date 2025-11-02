const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { sendEmail } = require("../utils/email");
// ...existing code...

// Admin approves user
exports.approveUser = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.approved = true;
    await user.save();

    // Send approval email
    let emailSent = false;
    try {
      await sendEmail({
        to: user.email,
        subject: "Your Account Has Been Approved",
        text: `Hello ${user.name},\n\nYour account has been approved by the admin. You can now log in and use your account.`,
        html: `<p>Hello ${user.name},</p><p>Your account has been <b>approved</b> by the admin. You can now log in and use your account.</p>`,
      });
      emailSent = true;
    } catch (emailErr) {
      // Log but don't block approval if email fails
      console.error("Failed to send approval email:", emailErr);
    }

    res.json({ message: "User approved.", emailSent });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Helper: Generate account number with prefix
function generateAccountNumber(type) {
  const prefixMap = {
    business: "BUS",
    student: "STU",
    savings: "SAV",
    person: "PER",
    school: "SCH",
  };
  const prefix = prefixMap[type] || "GEN";
  const uniquePart =
    Date.now().toString().slice(-6) +
    Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
  return `${prefix}-${uniquePart}`;
}

// Admin deposit
exports.deposit = async (req, res) => {
  try {
    const { accountNumber, amount, description } = req.body;
    const account = await Account.findOne({ accountNumber });
    if (!account) return res.status(404).json({ error: "Account not found" });
    account.balance += amount;
    await account.save();
    const transaction = new Transaction({
      to: account._id,
      amount,
      type: "deposit",
      description,
    });
    await transaction.save();
    res.json({
      message: "Deposit successful.",
      transaction: {
        to: transaction.to,
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
      account: {
        accountNumber: account.accountNumber,
        balance: account.balance,
        type: account.type,
        updatedAt: account.updatedAt || account.createdAt,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Transfer money
exports.transfer = async (req, res) => {
  try {
    const {
      fromAccountNumber,
      toAccountNumber,
      amount,
      description,
    } = req.body;
    const fromAccount = await Account.findOne({
      accountNumber: fromAccountNumber,
    }).populate("user", "name email");

    const toAccount = await Account.findOne({
      accountNumber: toAccountNumber,
    }).populate("user", "name email");
    if (!fromAccount || !toAccount)
      return res.status(404).json({ error: "Account not found" });
    if (fromAccount.balance < amount)
      return res.status(400).json({ error: "Insufficient funds" });
    fromAccount.balance -= amount;
    toAccount.balance += amount;
    await fromAccount.save();
    await toAccount.save();
    const transaction = new Transaction({
      from: fromAccount._id,
      to: toAccount._id,
      amount,
      type: "transfer",
      description,
    });
    await transaction.save();
    res.json({
      message: "Transfer successful.",
      transfer: {
        amount: amount,
        description: description || "Money transfer",
        timestamp: new Date(),
      },
      fromAccount: {
        accountNumber: fromAccount.accountNumber,
        remainingBalance: fromAccount.balance,
        accountType: fromAccount.type,
        accountHolderName: fromAccount.user?.name || "Unknown",
        accountHolderEmail: fromAccount.user?.email || "Unknown",
      },
      toAccount: {
        accountNumber: toAccount.accountNumber,
        newBalance: toAccount.balance,
        accountType: toAccount.type,
        accountHolderName: toAccount.user?.name || "Unknown",
        accountHolderEmail: toAccount.user?.email || "Unknown",
      },
      transaction: {
        transactionId: transaction._id,
        from: {
          accountNumber: fromAccount.accountNumber,
          accountHolderName: fromAccount.user?.name || "Unknown",
        },
        to: {
          accountNumber: toAccount.accountNumber,
          accountHolderName: toAccount.user?.name || "Unknown",
        },
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get transaction history
exports.transactions = async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const account = await Account.findOne({ accountNumber }).populate(
      "user",
      "name email"
    );
    if (!account) return res.status(404).json({ error: "Account not found" });

    const transactions = await Transaction.find({
      $or: [{ from: account._id }, { to: account._id }],
    })
      .populate("from", "accountNumber type user")
      .populate("to", "accountNumber type user")
      .sort({ createdAt: -1 });

    // Populate user details for from and to accounts
    await Transaction.populate(transactions, [
      { path: "from.user", select: "name email" },
      { path: "to.user", select: "name email" },
    ]);

    // Format the transactions for better readability
    const formattedTransactions = transactions.map((transaction) => {
      const isIncoming =
        transaction.to &&
        transaction.to._id.toString() === account._id.toString();
      const isOutgoing =
        transaction.from &&
        transaction.from._id.toString() === account._id.toString();

      // Format date and time for better readability
      const transactionDate = new Date(transaction.createdAt);
      const formattedDate = transactionDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const formattedTime = transactionDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      let transferSummary = null;
      if (isOutgoing && transaction.type === "transfer") {
        transferSummary = `Transferred k${transaction.amount} to ${
          transaction.to?.user?.name || "Unknown"
        } (${transaction.to?.accountNumber || "Unknown"})`;
      } else if (isIncoming && transaction.type === "transfer") {
        transferSummary = `Received k${transaction.amount} from ${
          transaction.from?.user?.name || "Unknown"
        } (${transaction.from?.accountNumber || "Unknown"})`;
      } else if (transaction.type === "deposit") {
        transferSummary = `Deposit of k${transaction.amount} to your account`;
      }

      return {
        transactionId: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.createdAt,
        formattedDate: formattedDate,
        formattedTime: formattedTime,
        dateTimeString: `${formattedDate} at ${formattedTime}`,
        direction: isIncoming
          ? "incoming"
          : isOutgoing
          ? "outgoing"
          : "unknown",
        transferSummary: transferSummary,
        from: transaction.from
          ? {
              accountNumber: transaction.from.accountNumber,
              accountType: transaction.from.type,
              accountHolderName: transaction.from.user?.name || "Unknown",
              accountHolderEmail: transaction.from.user?.email || "Unknown",
            }
          : null,
        to: transaction.to
          ? {
              accountNumber: transaction.to.accountNumber,
              accountType: transaction.to.type,
              accountHolderName: transaction.to.user?.name || "Unknown",
              accountHolderEmail: transaction.to.user?.email || "Unknown",
            }
          : null,
        status: "completed",
      };
    });

    // Separate outgoing transfers for easier viewing
    const outgoingTransfers = formattedTransactions.filter(
      (t) => t.direction === "outgoing" && t.type === "transfer"
    );

    const incomingTransactions = formattedTransactions.filter(
      (t) => t.direction === "incoming"
    );

    const allOtherTransactions = formattedTransactions.filter(
      (t) =>
        !(t.direction === "outgoing" && t.type === "transfer") &&
        t.direction !== "incoming"
    );

    res.json({
      message: "Transaction history retrieved successfully",
      account: {
        accountNumber: account.accountNumber,
        accountType: account.type,
        accountHolderName: account.user?.name || "Unknown",
        accountHolderEmail: account.user?.email || "Unknown",
        currentBalance: account.balance,
      },
      summary: {
        totalTransactions: formattedTransactions.length,
        outgoingTransfers: outgoingTransfers.length,
        incomingTransactions: incomingTransactions.length,
        totalAmountSent: outgoingTransfers.reduce(
          (sum, t) => sum + t.amount,
          0
        ),
        totalAmountReceived: incomingTransactions.reduce(
          (sum, t) => sum + t.amount,
          0
        ),
      },
      outgoingTransfers: outgoingTransfers,
      incomingTransactions: incomingTransactions,
      allTransactions: formattedTransactions,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
