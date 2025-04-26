// app.js
const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
    // Random delay between 10ms and 1000ms simulating task execution
    const delay = Math.floor(Math.random() * (500 - 10 + 1)) + 10;

    setTimeout(() => {
        res.send(`Execution time: ${delay}ms`,);
    }, delay);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Load Simulator app listening on port ${PORT}`);
});
