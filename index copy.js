// index.js
require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
// const { BigNumber } = require('ethers');


const app = express();
const port = 8080;

app.use(cors());
app.use(bodyParser.json());

let contracts = {};

app.post('/loadContract', async (req, res) => {
  const { contractAddress, abi } = req.body;

  try {
    let contractABI = abi;

    if (!abi) {
      // Fetch ABI from Etherscan
      const apiKey = process.env.ETHERSCAN_API_KEY;
      const response = await axios.get(`https://api-sepolia.etherscan.io/api`, {
        params: {
          module: 'contract',
          action: 'getabi',
          address: contractAddress,
          apikey: apiKey
        }
      });

      if (response.data.status !== '1') {
        return res.status(400).json({ error: 'Unable to fetch ABI from Etherscan' });
      }

      contractABI = JSON.parse(response.data.result);
    }

    // Save the contract ABI in memory
    contracts[contractAddress] = {
      abi: contractABI
    };

    res.json({ message: 'Contract loaded successfully', abi: contractABI });
  } catch (error) {
    console.error('Error loading contract:', error);
    res.status(500).json({ error: 'Error loading contract' });
  }
});

function bigIntToString(obj) {
  if (typeof obj === 'bigint') {
    return obj.toString();
  } else if (Array.isArray(obj)) {
    return obj.map(bigIntToString);
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = bigIntToString(obj[key]);
    }
    return newObj;
  } else {
    return obj;
  }
}


// function bigIntToString(obj) {
//   if (typeof obj === 'bigint' || BigNumber.isBigNumber(obj)) {
//     return obj.toString();
//   } else if (Array.isArray(obj)) {
//     return obj.map(bigIntToString);
//   } else if (typeof obj === 'object' && obj !== null) {
//     const newObj = {};
//     for (const key in obj) {
//       newObj[key] = bigIntToString(obj[key]);
//     }
//     return newObj;
//   } else {
//     return obj;
//   }
// }

app.post('/callFunction', async (req, res) => {
  const { contractAddress, functionName, params, privateKey } = req.body;

  try {
    const contractData = contracts[contractAddress];

    if (!contractData) {
      return res.status(400).json({ error: 'Contract not loaded. Please load the contract first.' });
    }

    const abi = contractData.abi;



    // Connect to Ethereum node (e.g., Infura or Alchemy)
    const provider = ethers.getDefaultProvider('sepolia'); // Use your network 

    // // Use a dedicated provider
    // const provider = new ethers.providers.InfuraProvider('sepolia', {
    //   projectId: 'YOUR_INFURA_PROJECT_ID',
    //   projectSecret: 'YOUR_INFURA_PROJECT_SECRET',
    // });

    let wallet;
    let contract;

    if (privateKey) {
      // For write functions
      wallet = new ethers.Wallet(privateKey, provider);
      contract = new ethers.Contract(contractAddress, abi, wallet);
    } else {
      // For read functions
      contract = new ethers.Contract(contractAddress, abi, provider);
    }

    // Get function fragment from ABI
    const functionFragment = abi.find(
      (item) => item.name === functionName && item.type === 'function'
    );

    if (!functionFragment) {
      return res.status(400).json({ error: 'Function not found in ABI' });
    }

    // Prepare function call
    let result;
    if (functionFragment.stateMutability === 'view' || functionFragment.stateMutability === 'pure') {
      // Read function
      result = await contract[functionName](...params);
    } else {
      // Write function
      const tx = await contract[functionName](...params);
      result = await tx.wait();
    }

    // Convert BigInt values to strings
    const sanitizedResult = bigIntToString(result);
    console.log('Raw result:', result);
    console.log('Sanitized result:', sanitizedResult);

    res.json({ result: sanitizedResult });
  } catch (error) {
    console.error('Error calling function:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});





// const express = require('express');
// const path = require('path')

// const app = express();

// const port = parseInt(process.env.PORT) || process.argv[3] || 8080;

// app.use(express.static(path.join(__dirname, 'public')))
//   .set('views', path.join(__dirname, 'views'))
//   .set('view engine', 'ejs');

// app.get('/', (req, res) => {
//   res.render('index');
// });

// app.get('/api', (req, res) => {
//   res.json({"msg": "Hello world"});
// });

// app.listen(port, () => {
//   console.log(`Listening on http://localhost:${port}`);
// })