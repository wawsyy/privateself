# Dream Journal - Encrypted Dream Journal using FHEVM

A privacy-preserving dream journal application that uses Fully Homomorphic Encryption (FHE) to store dream entries. Only encrypted data is stored on-chain, ensuring complete privacy.

## Features

- **Encrypted Storage**: Dream content is encrypted using FHE before being stored on-chain
- **Local Decryption**: Only you can decrypt and view your dreams
- **Privacy First**: The platform never sees your plaintext dream content
- **Rainbow Wallet Integration**: Connect using Rainbow wallet for a seamless experience

## Project Structure

```
pro16/
├── contracts/          # Solidity smart contracts
│   └── DreamJournal.sol
├── test/              # Hardhat tests
│   ├── DreamJournal.ts
│   └── DreamJournalSepolia.ts
├── deploy/            # Deployment scripts
│   └── deploy.ts
├── tasks/             # Hardhat tasks
│   └── DreamJournal.ts
└── frontend/          # Next.js frontend application
    ├── app/
    ├── components/
    └── hooks/
```

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 7.0.0

### Installation

1. Install dependencies:
```bash
cd pro16
npm install
cd frontend
npm install
```

2. Compile contracts:
```bash
npm run compile
```

3. Run tests:
```bash
npm test
```

### Deployment

#### Local Development

1. Start Hardhat node:
```bash
npx hardhat node
```

2. Deploy contract:
```bash
npx hardhat deploy --network localhost
```

3. Generate ABI files:
```bash
cd frontend
npm run genabi
```

4. Start frontend:
```bash
npm run dev:mock
```

#### Sepolia Testnet

1. Set up environment variables:
```bash
npx hardhat vars setup
```

2. Deploy contract:
```bash
npx hardhat deploy --network sepolia
```

3. Generate ABI files:
```bash
cd frontend
npm run genabi
```

4. Start frontend:
```bash
cd frontend
npm run dev
```

## Usage

### Creating a Dream Entry

1. Connect your Rainbow wallet
2. Enter a title for your dream
3. Write your dream content
4. Click "Create Dream" - the content will be encrypted locally before being stored

### Viewing Dreams

1. Your dreams are listed with titles and creation dates
2. Click "View" to decrypt and read a dream
3. Only you can decrypt your dreams

## Smart Contract

The `DreamJournal` contract stores:
- **Title**: Plaintext title for listing purposes
- **Encrypted Content**: FHE-encrypted dream text (stored as euint8[])
- **Metadata**: Owner address and creation timestamp

## Testing

Run local tests:
```bash
npm test
```

Run Sepolia tests:
```bash
npm run test:sepolia
```

## License

BSD-3-Clause-Clear

