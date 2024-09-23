// index.js
require('dotenv').config();
const express = require('express');
const { ethers, BigNumber } = require('ethers'); // Import BigNumber
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 8080;

app.use(cors());
app.use(bodyParser.json());

let contracts = {};

// Endpoint to load the contract ABI
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
          apikey: apiKey,
        },
      });

      if (response.data.status !== '1') {
        return res.status(400).json({ error: 'Unable to fetch ABI from Etherscan' });
      }

      contractABI = JSON.parse(response.data.result);
    }

    // Save the contract ABI in memory
    contracts[contractAddress] = {
      abi: contractABI,
    };

    res.json({ message: 'Contract loaded successfully', abi: contractABI });
  } catch (error) {
    console.error('Error loading contract:', error);
    res.status(500).json({ error: 'Error loading contract' });
  }
});

// Function to convert BigInt and BigNumber values to strings
function bigIntToString(obj) {
  if (typeof obj === 'bigint' || BigNumber.isBigNumber(obj)) {
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

// Endpoint to call read functions
app.post('/callFunction', async (req, res) => {
  const { contractAddress, functionName, params } = req.body;

  try {
    const contractData = contracts[contractAddress];

    if (!contractData) {
      return res.status(400).json({ error: 'Contract not loaded. Please load the contract first.' });
    }

    const abi = contractData.abi;

    // Use a provider for read functions
    // Connect to Ethereum node (e.g., Infura or Alchemy)
    const provider = ethers.getDefaultProvider('sepolia'); // Use your network

    const contract = new ethers.Contract(contractAddress, abi, provider);

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

      // Convert BigInt and BigNumber values to strings
      const sanitizedResult = bigIntToString(result);
      console.log('Raw result:', result);
      console.log('Sanitized result:', sanitizedResult);

      res.json({ result: sanitizedResult });
    } else {
      // For write functions, inform that they are handled on the client via MetaMask
      res.status(400).json({ error: 'Write functions are handled on the client via MetaMask.' });
    }
  } catch (error) {
    console.error('Error calling function:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
