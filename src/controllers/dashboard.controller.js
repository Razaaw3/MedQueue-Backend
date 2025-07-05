import UserToken from "../models/userToken.model.js";
import { DateTime } from "luxon";
import PDFDocument from "pdfkit";

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    const currentMonthStart = DateTime.now().startOf("month");
    const previousMonthStart = DateTime.now()
      .minus({ months: 1 })
      .startOf("month");
    const previousMonthEnd = DateTime.now().minus({ months: 1 }).endOf("month");
    const lastHour = DateTime.now().minus({ hours: 1 });

    const currentMonthTokens = await UserToken.countDocuments({
      createdAt: {
        $gte: currentMonthStart.toJSDate(),
      },
    });

    const lastMonthTokens = await UserToken.countDocuments({
      createdAt: {
        $gte: previousMonthStart.toJSDate(),
        $lte: previousMonthEnd.toJSDate(),
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
        $gte: currentMonthStart.toJSDate(),
      },
    });

    const lastMonthVisited = await UserToken.countDocuments({
      checkInOutStatus: "completed",
      createdAt: {
        $gte: previousMonthStart.toJSDate(),
        $lte: previousMonthEnd.toJSDate(),
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
        $gte: currentMonthStart.toJSDate(),
      },
    });

    const lastMonthCancelled = await UserToken.countDocuments({
      checkInOutStatus: "cancelled",
      createdAt: {
        $gte: previousMonthStart.toJSDate(),
        $lte: previousMonthEnd.toJSDate(),
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
      createdAt: { $gte: lastHour.toJSDate() },
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
    const now = DateTime.now();

    let currentPeriodStart,
      currentPeriodEnd,
      previousPeriodStart,
      previousPeriodEnd;

    if (period === "month") {
      currentPeriodStart = DateTime.now().startOf("year");
      currentPeriodEnd = DateTime.now();

      previousPeriodStart = DateTime.now().minus({ years: 1 }).startOf("year");
      previousPeriodEnd = DateTime.now().minus({ years: 1 }).endOf("year");
    } else {
      currentPeriodStart = DateTime.now().startOf("week");
      currentPeriodEnd = DateTime.now().endOf("week");
      previousPeriodStart = DateTime.now().minus({ weeks: 1 }).startOf("week");
      previousPeriodEnd = DateTime.now().minus({ weeks: 1 }).endOf("week");
    }

    const currentPeriodData = await UserToken.aggregate([
      {
        $match: {
          createdAt: {
            $gte: currentPeriodStart.toJSDate(),
            $lte: currentPeriodEnd.toJSDate(),
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
            $gte: previousPeriodStart.toJSDate(),
            $lte: previousPeriodEnd.toJSDate(),
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

    const currentMonth = now.month;
    const currentMonthData = currentPeriodData.find(
      (d) => d._id.month === currentMonth
    );

    const formatPeriodData = (data, year) => {
      const months = [];
      for (let i = 0; i < 12; i++) {
        const monthData = data.find((d) => d._id.month === i + 1);
        months.push({
          day: DateTime.now()
            .set({ month: i + 1 })
            .toFormat("MMM"),
          date: DateTime.now()
            .set({ year, month: i + 1 })
            .toFormat("yyyy-MM-dd"),
          token: monthData ? monthData.count : 0,
        });
      }
      return months;
    };

    const currentPeriodFormatted = formatPeriodData(
      currentPeriodData,
      currentPeriodStart.year
    );
    const previousPeriodFormatted = formatPeriodData(
      previousPeriodData,
      previousPeriodStart.year
    );

    res.status(200).json({
      success: true,
      data: {
        currentPeriod: {
          data: currentPeriodFormatted,
          startDate: currentPeriodStart.toFormat("yyyy-MM-dd"),
          endDate: currentPeriodEnd.toFormat("yyyy-MM-dd"),
        },
        previousPeriod: {
          data: previousPeriodFormatted,
          startDate: previousPeriodStart.toFormat("yyyy-MM-dd"),
          endDate: previousPeriodEnd.toFormat("yyyy-MM-dd"),
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
    const currentMonthStart = DateTime.now().startOf("month");
    const currentMonthEnd = DateTime.now().endOf("month");
    const previousMonthStart = DateTime.now()
      .minus({ months: 1 })
      .startOf("month");
    const previousMonthEnd = DateTime.now().minus({ months: 1 }).endOf("month");

    const currentMonthUpcoming = await UserToken.countDocuments({
      checkInOutStatus: "pending",
      isExpired: false,
      createdAt: {
        $gte: currentMonthStart.toJSDate(),
        $lte: currentMonthEnd.toJSDate(),
      },
    });

    const currentMonthOnsite = await UserToken.countDocuments({
      checkInOutStatus: "onsite",
      createdAt: {
        $gte: currentMonthStart.toJSDate(),
        $lte: currentMonthEnd.toJSDate(),
      },
    });

    const currentMonthVisited = await UserToken.countDocuments({
      checkInOutStatus: "completed",
      createdAt: {
        $gte: currentMonthStart.toJSDate(),
        $lte: currentMonthEnd.toJSDate(),
      },
    });

    const currentMonthCancelled = await UserToken.countDocuments({
      checkInOutStatus: "cancelled",
      createdAt: {
        $gte: currentMonthStart.toJSDate(),
        $lte: currentMonthEnd.toJSDate(),
      },
    });

    const previousMonthTotal = await UserToken.countDocuments({
      createdAt: {
        $gte: previousMonthStart.toJSDate(),
        $lte: previousMonthEnd.toJSDate(),
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
      `attachment; filename=dashboard-report-${DateTime.now().toFormat(
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
          `Period: ${DateTime.fromISO(startDate).toFormat(
            "MMMM D, YYYY"
          )} - ${DateTime.fromISO(endDate).toFormat("MMMM D, YYYY")}`,
          { align: "center" }
        )
        .moveDown();
    }

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: DateTime.fromISO(startDate).startOf("day").toJSDate(),
        $lte: DateTime.fromISO(endDate).endOf("day").toJSDate(),
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
        `Report generated on ${DateTime.now().toFormat(
          "MMMM D, YYYY [at] HH:mm:ss"
        )}`,
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
