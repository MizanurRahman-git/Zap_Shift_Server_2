const express = require('express');
const cors = require('cors')
const app = express()
require('dotenv').config()
const port = process.env.PORT || 3000


// MiddleWere 
app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send('Zap-Shift-2 is Running....')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})