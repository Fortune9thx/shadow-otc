require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            viaIR: true,
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
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
