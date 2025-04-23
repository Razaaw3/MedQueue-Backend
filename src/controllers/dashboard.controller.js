import UserToken from "../models/userToken.model.js";
import moment from "moment-timezone";

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    // Calculate start of current month and previous month
    const currentMonthStart = moment().startOf("month");
    const previousMonthStart = moment().subtract(1, "month").startOf("month");
    const previousMonthEnd = moment().subtract(1, "month").endOf("month");
    const lastHour = moment().subtract(1, "hour");

    // Get total tokens for current month and last month
    const currentMonthTokens = await UserToken.countDocuments({
      createdAt: {
        $gte: currentMonthStart.toDate(),
      },
    });

    const lastMonthTokens = await UserToken.countDocuments({
      createdAt: {
        $gte: previousMonthStart.toDate(),
        $lte: previousMonthEnd.toDate(),
      },
    });

    // Calculate token percentage change
    const tokenPercentageChange =
      lastMonthTokens === 0
        ? 100
        : (
            ((currentMonthTokens - lastMonthTokens) / lastMonthTokens) *
            100
          ).toFixed(1);

    // Get total visited (completed tokens)
    const currentMonthVisited = await UserToken.countDocuments({
      checkInOutStatus: "completed",
      createdAt: {
        $gte: currentMonthStart.toDate(),
      },
    });

    const lastMonthVisited = await UserToken.countDocuments({
      checkInOutStatus: "completed",
      createdAt: {
        $gte: previousMonthStart.toDate(),
        $lte: previousMonthEnd.toDate(),
      },
    });

    // Calculate visited percentage change
    const visitedPercentageChange =
      lastMonthVisited === 0
        ? 100
        : (
            ((currentMonthVisited - lastMonthVisited) / lastMonthVisited) *
            100
          ).toFixed(1);

    // Get total cancelled
    const currentMonthCancelled = await UserToken.countDocuments({
      checkInOutStatus: "cancelled",
      createdAt: {
        $gte: currentMonthStart.toDate(),
      },
    });

    const lastMonthCancelled = await UserToken.countDocuments({
      checkInOutStatus: "cancelled",
      createdAt: {
        $gte: previousMonthStart.toDate(),
        $lte: previousMonthEnd.toDate(),
      },
    });

    // Calculate cancelled percentage change
    const cancelledPercentageChange =
      lastMonthCancelled === 0
        ? 0
        : (
            ((currentMonthCancelled - lastMonthCancelled) /
              lastMonthCancelled) *
            100
          ).toFixed(1);

    // Get total pending
    const currentPending = await UserToken.countDocuments({
      checkInOutStatus: "pending",
      isExpired: false,
    });

    const lastHourPending = await UserToken.countDocuments({
      checkInOutStatus: "pending",
      createdAt: { $gte: lastHour.toDate() },
    });

    res.status(200).json({
      success: true,
      data: {
        tokens: {
          total: currentMonthTokens + lastMonthTokens, // Total of both months
          percentageChange: tokenPercentageChange,
          trend: "from last month",
        },
        visited: {
          total: currentMonthVisited + lastMonthVisited,
          percentageChange: visitedPercentageChange,
          trend: "more visitors this month",
        },
        cancelled: {
          total: currentMonthCancelled,
          percentageChange: cancelledPercentageChange,
          trend: "decrease from last month",
        },
        pending: {
          total: currentPending,
          newRequests: lastHourPending,
          trend: "pending requests since last hour",
        },
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
      error: error.message,
    });
  }
};
