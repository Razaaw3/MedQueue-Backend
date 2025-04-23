import UserToken from "../models/userToken.model.js";
import moment from "moment-timezone";
import PDFDocument from "pdfkit";

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    const currentMonthStart = moment().startOf("month");
    const previousMonthStart = moment().subtract(1, "month").startOf("month");
    const previousMonthEnd = moment().subtract(1, "month").endOf("month");
    const lastHour = moment().subtract(1, "hour");

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

    const tokenPercentageChange =
      lastMonthTokens === 0
        ? 100
        : (
            ((currentMonthTokens - lastMonthTokens) / lastMonthTokens) *
            100
          ).toFixed(1);

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

    const visitedPercentageChange =
      lastMonthVisited === 0
        ? 100
        : (
            ((currentMonthVisited - lastMonthVisited) / lastMonthVisited) *
            100
          ).toFixed(1);

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

    const cancelledPercentageChange =
      lastMonthCancelled === 0
        ? 0
        : (
            ((currentMonthCancelled - lastMonthCancelled) /
              lastMonthCancelled) *
            100
          ).toFixed(1);

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

// Get token tracks data
export const getTokenTracks = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const now = moment();

    let currentPeriodStart,
      currentPeriodEnd,
      previousPeriodStart,
      previousPeriodEnd;

    if (period === "month") {
      currentPeriodStart = moment().startOf("year");
      currentPeriodEnd = moment();

      previousPeriodStart = moment().subtract(1, "year").startOf("year");
      previousPeriodEnd = moment().subtract(1, "year").endOf("year");
    } else {
      currentPeriodStart = moment().startOf("week");
      currentPeriodEnd = moment().endOf("week");
      previousPeriodStart = moment().subtract(1, "week").startOf("week");
      previousPeriodEnd = moment().subtract(1, "week").endOf("week");
    }

    const currentPeriodData = await UserToken.aggregate([
      {
        $match: {
          createdAt: {
            $gte: currentPeriodStart.toDate(),
            $lte: currentPeriodEnd.toDate(),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
          date: { $first: "$createdAt" },
        },
      },
      {
        $sort: { "_id.month": 1 },
      },
    ]);

    const previousPeriodData = await UserToken.aggregate([
      {
        $match: {
          createdAt: {
            $gte: previousPeriodStart.toDate(),
            $lte: previousPeriodEnd.toDate(),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
          date: { $first: "$createdAt" },
        },
      },
      {
        $sort: { "_id.month": 1 },
      },
    ]);

    const currentMonth = now.month();
    const currentMonthData = currentPeriodData.find(
      (d) => d._id.month === currentMonth + 1
    );
    const previousMonthData = currentPeriodData.find(
      (d) => d._id.month === currentMonth
    );

    const percentageChange = previousMonthData?.count
      ? (((currentMonthData?.count || 0) - previousMonthData.count) /
          previousMonthData.count) *
        100
      : 0;

    const formatPeriodData = (data, year) => {
      return Array.from({ length: 12 }, (_, i) => {
        const monthData = data.find((d) => d._id.month === i + 1);
        return {
          day: moment().month(i).format("MMM"),
          date: moment().year(year).month(i).format("YYYY-MM-DD"),
          token: monthData?.count || 0,
        };
      });
    };

    const currentYear = now.year();
    const previousYear = currentYear - 1;

    res.status(200).json({
      success: true,
      data: {
        currentPeriod: {
          data: formatPeriodData(currentPeriodData, currentYear),
          percentageChange: Number(percentageChange.toFixed(1)),
          startDate: currentPeriodStart.format("YYYY-MM-DD"),
          endDate: currentPeriodEnd.format("YYYY-MM-DD"),
        },
        previousPeriod: {
          data: formatPeriodData(previousPeriodData, previousYear),
          startDate: previousPeriodStart.format("YYYY-MM-DD"),
          endDate: previousPeriodEnd.format("YYYY-MM-DD"),
        },
      },
    });
  } catch (error) {
    console.error("Token tracks error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching token tracks",
      error: error.message,
    });
  }
};

// Get appointments data
export const getAppointments = async (req, res) => {
  try {
    const currentMonthStart = moment().startOf("month");
    const currentMonthEnd = moment().endOf("month");
    const previousMonthStart = moment().subtract(1, "month").startOf("month");
    const previousMonthEnd = moment().subtract(1, "month").endOf("month");

    const currentMonthUpcoming = await UserToken.countDocuments({
      checkInOutStatus: "pending",
      isExpired: false,
      createdAt: {
        $gte: currentMonthStart.toDate(),
        $lte: currentMonthEnd.toDate(),
      },
    });

    const currentMonthOnsite = await UserToken.countDocuments({
      checkInOutStatus: "onsite",
      createdAt: {
        $gte: currentMonthStart.toDate(),
        $lte: currentMonthEnd.toDate(),
      },
    });

    const currentMonthVisited = await UserToken.countDocuments({
      checkInOutStatus: "completed",
      createdAt: {
        $gte: currentMonthStart.toDate(),
        $lte: currentMonthEnd.toDate(),
      },
    });

    const currentMonthCancelled = await UserToken.countDocuments({
      checkInOutStatus: "cancelled",
      createdAt: {
        $gte: currentMonthStart.toDate(),
        $lte: currentMonthEnd.toDate(),
      },
    });

    const previousMonthTotal = await UserToken.countDocuments({
      createdAt: {
        $gte: previousMonthStart.toDate(),
        $lte: previousMonthEnd.toDate(),
      },
    });

    const currentMonthTotal =
      currentMonthUpcoming +
      currentMonthOnsite +
      currentMonthVisited +
      currentMonthCancelled;

    const percentageChange =
      previousMonthTotal === 0
        ? 100
        : Number(
            (
              ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) *
              100
            ).toFixed(1)
          );

    res.status(200).json({
      success: true,
      data: {
        upcoming: currentMonthUpcoming,
        onsite: currentMonthOnsite,
        visited: currentMonthVisited,
        cancelled: currentMonthCancelled,
        percentageChange,
      },
    });
  } catch (error) {
    console.error("Appointments data error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching appointments data",
      error: error.message,
    });
  }
};

// Download dashboard report
export const downloadReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const doc = new PDFDocument();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=dashboard-report-${moment().format(
        "YYYY-MM-DD"
      )}.pdf`
    );

    doc.pipe(res);

    // Add report title
    doc
      .fontSize(20)
      .text("MedQueue Dashboard Report", { align: "center" })
      .moveDown();

    if (startDate && endDate) {
      doc
        .fontSize(12)
        .text(
          `Period: ${moment(startDate).format("MMMM D, YYYY")} - ${moment(
            endDate
          ).format("MMMM D, YYYY")}`,
          { align: "center" }
        )
        .moveDown();
    }

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: moment(startDate).startOf("day").toDate(),
        $lte: moment(endDate).endOf("day").toDate(),
      };
    }

    const totalTokens = await UserToken.countDocuments(dateFilter);

    const completedTokens = await UserToken.countDocuments({
      ...dateFilter,
      checkInOutStatus: "completed",
    });
    const pendingTokens = await UserToken.countDocuments({
      ...dateFilter,
      checkInOutStatus: "pending",
    });
    const cancelledTokens = await UserToken.countDocuments({
      ...dateFilter,
      checkInOutStatus: "cancelled",
    });
    const onsiteTokens = await UserToken.countDocuments({
      ...dateFilter,
      checkInOutStatus: "onsite",
    });

    doc.fontSize(16).text("Statistics", { underline: true }).moveDown();

    doc
      .fontSize(12)
      .text(`Total Tokens: ${totalTokens}`)
      .text(`Completed Appointments: ${completedTokens}`)
      .text(`Pending Appointments: ${pendingTokens}`)
      .text(`Cancelled Appointments: ${cancelledTokens}`)
      .text(`Onsite Patients: ${onsiteTokens}`)
      .moveDown();

    const completionRate = ((completedTokens / totalTokens) * 100).toFixed(1);
    const cancellationRate = ((cancelledTokens / totalTokens) * 100).toFixed(1);

    doc
      .fontSize(14)
      .text("Key Metrics", { underline: true })
      .moveDown()
      .fontSize(12)
      .text(`Completion Rate: ${completionRate}%`)
      .text(`Cancellation Rate: ${cancellationRate}%`)
      .moveDown();

    doc
      .fontSize(10)
      .text(
        `Report generated on ${moment().format("MMMM D, YYYY [at] HH:mm:ss")}`,
        { align: "right" }
      );

    doc.end();
  } catch (error) {
    console.error("Report generation error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating report",
      error: error.message,
    });
  }
};
