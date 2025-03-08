// import moment from 'moment';
// import TimeSlots from '../models/timeSlots.model.js';

// export const createMonthlyTimeSlots = async (
//   month,
//   year,
//   openingTime,
//   closingTime
// ) => {
//   const firstDayOfMonth = moment()
//     .year(year)
//     .month(month - 1)
//     .startOf('month');
//   const lastDayOfMonth = moment()
//     .year(year)
//     .month(month - 1)
//     .endOf('month');

//   const workingDays = [];

//   for (
//     let date = moment(firstDayOfMonth);
//     date.isSameOrBefore(lastDayOfMonth);
//     date.add(1, 'days')
//   ) {
//     // // For monday - friday
//     // if (date.isoWeekday() >= 1 && date.isoWeekday() <= 5) {
//     //   workingDays.push(date.format("YYYY-MM-DD"));
//     // }

//     // for all days
//     workingDays.push(date.format('YYYY-MM-DD'));
//   }

//   const timeSlots = [];
//   for (const day of workingDays) {
//     const existingSlots = await TimeSlots.findOne({
//       date: new Date(day),
//       clinicOpeningTime: openingTime,
//       clinicClosingTime: closingTime,
//     });

//     if (!existingSlots) {
//       const slots = [];
//       let currentMoment = moment(day)
//         .hour(openingTime.split(':')[0])
//         .minute(openingTime.split(':')[1]);
//       const closingMoment = moment(day)
//         .hour(closingTime.split(':')[0])
//         .minute(closingTime.split(':')[1]);
//       let slotNumber = 1;

//       while (currentMoment.isBefore(closingMoment)) {
//         const startTime = currentMoment.format('HH:mm');
//         const endMoment = moment(currentMoment).add(10, 'minutes');
//         const endTime = endMoment.format('HH:mm');

//         slots.push({
//           startingTime: startTime,
//           endingTime: endTime,
//           slotNumber: slotNumber++,
//           isReserved: false,
//         });

//         currentMoment = endMoment;
//       }

//       const createdSlots = await TimeSlots.create({
//         date: new Date(day),
//         clinicOpeningTime: openingTime,
//         clinicClosingTime: closingTime,
//         timeSlots: slots,
//       });

//       timeSlots.push(createdSlots);
//     }
//   }

//   return timeSlots;
// };
