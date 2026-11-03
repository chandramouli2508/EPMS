// function findSecondHighest(numbers) {
//     if (!Array.isArray(numbers)) {
//         return ("its not an array")
//     }
//     let highest = -Infinity
//     let secHighest = -Infinity
//     for (num of numbers) {
//         if (num > highest) {
//             secHighest = highest
//             highest = num
//         }
//         else if (num < highest && secHighest < num) {
//             secHighest = num
//         }
//     }
//     return secHighest === -Infinity ? null : secHighest;
// }

// const numbers = [5, 5, 5, 5];

// console.log(findSecondHighest(numbers)); // 18
// console.log("A");

// setTimeout(() => {
//     console.log("B");
// }, 0);

// Promise.resolve().then(() => {
//     console.log("C");
// });

// async function test() {
//     console.log("D");

//     await Promise.resolve();

//     console.log("E");
// }

// test();

// console.log("F");

async function first() {
    console.log("A");
    return "B";
}

async function second() {
    console.log("C");
    const result = await first();
    console.log(result);
    return "D";
}

console.log("E");

second().then(value => console.log(value));

console.log("F");

//  e c a f b d
// 1 6 4 2 3  5