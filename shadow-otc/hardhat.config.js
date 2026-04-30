require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
    solidity: "0.8.20",
    paths: {
        sources: "./contracts/src",
    },
    networks: {
        ritual: {
            url: process.env.RITUAL_RPC_URL,
            chainId: 1979,
            accounts: [process.env.PRIVATE_KEY],
        },
    },
};