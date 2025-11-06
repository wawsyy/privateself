"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { useFhevm } from "@/fhevm/useFhevm";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { useEthersSigner, useEthersProvider } from "@/hooks/useEthersSigner";
import { useDreamJournal } from "@/hooks/useDreamJournal";
import { errorNotDeployed } from "./ErrorNotDeployed";

export const DreamJournalDemo = () => {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showDecrypted, setShowDecrypted] = useState<Record<string, boolean>>({});
  const [ethersSigner, setEthersSigner] = useState<ethers.JsonRpcSigner | undefined>(undefined);

  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  
  const ethersProvider = useEthersProvider({ chainId });
  
  // Get EIP1193 provider - for local Hardhat, use RPC URL string directly
  // For other networks, use walletClient transport or window.ethereum
  const eip1193Provider = useMemo(() => {
    if (chainId === 31337) {
      // For local Hardhat, use RPC URL string
      return "http://localhost:8545";
    }
    
    // For other networks, try to get from walletClient
    if (walletClient?.transport) {
      const transport = walletClient.transport as any;
      // Try to extract EIP1193 provider from transport
      if (transport.value && typeof transport.value.request === "function") {
        return transport.value;
      }
      if (typeof transport.request === "function") {
        return transport;
      }
    }
    
    // Fallback to window.ethereum
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    
    return undefined;
  }, [chainId, walletClient]);

  // Convert walletClient to ethers signer
  useEffect(() => {
    if (walletClient) {
      const { account, chain, transport } = walletClient;
      const network = {
        chainId: chain.id,
        name: chain.name,
        ensAddress: chain.contracts?.ensRegistry?.address,
      };
      
      try {
        // Create provider from transport
        const provider = new ethers.BrowserProvider(transport as any, network);
        provider.getSigner(account.address)
          .then(setEthersSigner)
          .catch((err) => {
            console.error("Failed to get signer:", err);
            setEthersSigner(undefined);
          });
      } catch (err) {
        console.error("Failed to create provider:", err);
        setEthersSigner(undefined);
      }
    } else {
      setEthersSigner(undefined);
    }
  }, [walletClient]);

  // FHEVM instance
  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider: eip1193Provider,
    chainId,
    initialMockChains: { 31337: "http://localhost:8545" },
    enabled: isConnected && !!eip1193Provider,
  });

  // Debug: Log provider info and FHEVM status (only when status changes significantly)
  const lastDebugRef = useRef<string>("");
  useEffect(() => {
    if (isConnected) {
      const debugKey = `${chainId}-${fhevmStatus}-${!!eip1193Provider}-${!!ethersSigner}`;
      // Only log when something significant changes
      if (debugKey !== lastDebugRef.current) {
        lastDebugRef.current = debugKey;
        console.log("Provider Debug:", {
          chainId,
          hasEip1193Provider: !!eip1193Provider,
          providerType: typeof eip1193Provider,
          hasWalletClient: !!walletClient,
          hasEthersSigner: !!ethersSigner,
          hasEthersProvider: !!ethersProvider,
          fhevmStatus,
          fhevmError: fhevmError ? {
            name: fhevmError.name,
            message: fhevmError.message,
          } : null,
        });
      }
    }
  }, [isConnected, chainId, eip1193Provider, walletClient, ethersSigner, ethersProvider, fhevmStatus, fhevmError]);

  // Same chain/signer refs
  const sameChainRef = useRef((id: number | undefined) => id === chainId);
  const currentSignerAddressRef = useRef<string | undefined>(undefined);
  
  // Update signer address ref when signer changes
  useEffect(() => {
    if (ethersSigner) {
      ethersSigner.getAddress().then((addr) => {
        currentSignerAddressRef.current = addr.toLowerCase();
      }).catch(() => {
        currentSignerAddressRef.current = undefined;
      });
    } else {
      currentSignerAddressRef.current = undefined;
    }
  }, [ethersSigner]);
  
  const sameSignerRef = useRef(async (signer: ethers.JsonRpcSigner | undefined) => {
    if (!signer) {
      return !currentSignerAddressRef.current; // Both undefined
    }
    if (!currentSignerAddressRef.current) {
      return false; // Current signer is undefined but provided signer is not
    }
    try {
      const signerAddress = (await signer.getAddress()).toLowerCase();
      return signerAddress === currentSignerAddressRef.current;
    } catch {
      return false;
    }
  });

  // Dream journal hook
  const {
    contractAddress,
    dreams,
    isLoading,
    isCreating,
    message,
    canCreate,
    canLoadDreams,
    isDeployed,
    createDream,
    loadDreams,
    decryptDream,
  } = useDreamJournal({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    eip1193Provider,
    chainId,
    ethersSigner: ethersSigner || undefined,
    ethersReadonlyProvider: ethersProvider || undefined,
    sameChain: sameChainRef,
    sameSigner: sameSignerRef,
  });

  const handleCreateDreamRef = useRef(false);
  
  const handleCreateDream = useCallback(() => {
    // Prevent duplicate calls - use ref to track
    if (handleCreateDreamRef.current) {
      console.log("[handleCreateDream] Already processing (ref=true), ignoring duplicate call");
      return;
    }
    
    if (isCreating) {
      console.log("[handleCreateDream] isCreating=true, ignoring duplicate call");
      return;
    }
    
    if (!title.trim() || !content.trim()) {
      alert("Please enter both title and content");
      return;
    }
    
    // Check if FHEVM instance is ready before creating
    if (!fhevmInstance) {
      alert("Zama FHEVM instance is not ready. Please wait a moment and try again.\n\nIf this persists, check:\n1. Wallet is connected\n2. Network is Hardhat Local (Chain ID: 31337)\n3. Hardhat node is running\n4. FHEVM libraries are properly loaded");
      return;
    }
    
    handleCreateDreamRef.current = true;
    console.log("[handleCreateDream] Creating dream with:", { 
      title: title.trim(), 
      contentLength: content.trim().length, 
      hasInstance: !!fhevmInstance,
      fhevmStatus,
      hasSigner: !!ethersSigner,
      contractAddress,
      canCreate,
      isCreating,
    });
    
    // Call createDream
    createDream(title.trim(), content.trim());
    
    // Reset the ref after a delay to allow retry if needed
    setTimeout(() => {
      handleCreateDreamRef.current = false;
    }, 5000);
  }, [title, content, createDream, fhevmInstance, fhevmStatus, ethersSigner, contractAddress, canCreate, isCreating]);
  
  // Clear form when dream is created successfully
  useEffect(() => {
    if (message && message.includes("Dream created successfully")) {
      setTitle("");
      setContent("");
    }
  }, [message]);

  const handleDecryptDream = useCallback(
    (dreamId: bigint) => {
      const dream = dreams.find((d) => d.id === dreamId);
      if (dream?.decryptedContent) {
        // Toggle display
        setShowDecrypted((prev) => ({
          ...prev,
          [dreamId.toString()]: !prev[dreamId.toString()],
        }));
      } else {
        // Decrypt
        decryptDream(dreamId);
        setShowDecrypted((prev) => ({
          ...prev,
          [dreamId.toString()]: true,
        }));
      }
    },
    [dreams, decryptDream]
  );

  if (!isConnected) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-800">
            Welcome to Encrypted Dream Journal
          </h2>
          <p className="text-gray-600 mb-8">
            Connect your Rainbow wallet to start recording your encrypted dreams.
            Your dreams are fully homomorphically encrypted on-chain and only you can decrypt them.
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  // Display FHEVM error if present
  if (fhevmError && fhevmStatus === "error") {
    const isHardhat = chainId === 31337;
    const isSepolia = chainId === 11155111;
    
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4 text-red-800">
            Zama FHEVM Initialization Error
          </h2>
          <p className="text-red-700 mb-4">
            <strong>Error:</strong> {fhevmError.message}
          </p>
          <p className="text-red-600 mb-4 text-sm">
            <strong>Current Network:</strong> Chain ID {chainId} {isSepolia ? "(Sepolia Testnet)" : isHardhat ? "(Hardhat Local)" : ""}
          </p>
          <div className="bg-white p-4 rounded-lg border border-red-300">
            <p className="font-semibold text-gray-800 mb-2">Troubleshooting Steps:</p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              {isHardhat ? (
                <>
                  <li>Ensure Hardhat node is running:
                    <code className="bg-gray-100 px-2 py-1 rounded ml-2">npx hardhat node</code>
                  </li>
                  <li>Verify RPC endpoint is accessible:
                    <code className="bg-gray-100 px-2 py-1 rounded ml-2">http://localhost:8545</code>
                  </li>
                  <li>Check that you're connected to Hardhat Local network (Chain ID: 31337)</li>
                </>
              ) : isSepolia ? (
                <>
                  <li>Verify you're connected to Sepolia Testnet (Chain ID: 11155111)</li>
                  <li>Check that your wallet has Sepolia ETH for gas fees</li>
                  <li>Ensure the FHEVM relayer service is accessible (this may be a temporary service issue)</li>
                  <li>The error "Relayer didn't response correctly. Bad JSON" suggests the relayer service may be down or unreachable</li>
                </>
              ) : (
                <>
                  <li>Check that you're connected to a supported network (Sepolia or Hardhat Local)</li>
                  <li>Current network Chain ID: {chainId}</li>
                </>
              )}
              <li>Try refreshing the page</li>
              <li>Check browser console for more details</li>
            </ol>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Check if on supported network (Hardhat Local or Sepolia)
  const isCorrectNetwork = chainId === 31337 || chainId === 11155111; // Hardhat local or Sepolia
  
  if (!isCorrectNetwork && chainId !== undefined) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4 text-yellow-800">
            Wrong Network Detected
          </h2>
          <p className="text-yellow-700 mb-4">
            You are connected to network with Chain ID: <strong>{chainId}</strong>
          </p>
          <p className="text-yellow-700 mb-6">
            Please switch to <strong>Hardhat Local</strong> (Chain ID: 31337) or <strong>Sepolia</strong> (Chain ID: 11155111) to use this application.
          </p>
          <div className="bg-white p-4 rounded-lg border border-yellow-300">
            <p className="font-semibold text-gray-800 mb-2">Supported Networks:</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 mb-4">
              <li><strong>Sepolia Testnet</strong> (Chain ID: 11155111) - Already configured in Rainbow wallet</li>
              <li><strong>Hardhat Local</strong> (Chain ID: 31337) - For local development</li>
            </ul>
            <p className="font-semibold text-gray-800 mb-2">To add Hardhat Local network in Rainbow (for local development):</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>Click on network selector in Rainbow wallet</li>
              <li>Click "Add Network" or "Custom Network"</li>
              <li>Enter these details:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>Network Name: <code className="bg-gray-100 px-1 rounded">Hardhat Local</code></li>
                  <li>RPC URL: <code className="bg-gray-100 px-1 rounded">http://localhost:8545</code></li>
                  <li>Chain ID: <code className="bg-gray-100 px-1 rounded">31337</code></li>
                  <li>Currency Symbol: <code className="bg-gray-100 px-1 rounded">ETH</code></li>
                </ul>
              </li>
              <li>Make sure Hardhat node is running: <code className="bg-gray-100 px-1 rounded">npx hardhat node</code></li>
            </ol>
          </div>
          <div className="mt-6">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (isDeployed === false) {
    return errorNotDeployed(chainId);
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">My Encrypted Dreams</h2>
          <ConnectButton />
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-gray-600">
          <span>Connected: {address}</span>
          {contractAddress && (
            <>
              <span>•</span>
              <span>Contract: {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}</span>
            </>
          )}
          {message && (
            <>
              <span>•</span>
              <span className="text-blue-600">{message}</span>
            </>
          )}
        </div>
      </div>

      {/* Create Dream Form */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-800">
          Create New Encrypted Dream
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Flying Dream"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isCreating}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dream Content (FHE Encrypted)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your dream... (will be FHE encrypted before storage)"
              rows={5}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              disabled={isCreating}
            />
            <p className="mt-1 text-xs text-gray-500">
              Your dream content will be fully homomorphically encrypted locally before being stored on-chain.
            </p>
          </div>
          <button
            onClick={handleCreateDream}
            disabled={!canCreate || !title.trim() || !content.trim()}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Homomorphically Encrypting..." : "FHE Encrypt & Create Dream"}
          </button>
        </div>
      </div>

      {/* Dreams List */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">
            My Encrypted Dream Entries ({dreams.length})
          </h3>
          <button
            onClick={loadDreams}
            disabled={!canLoadDreams || isLoading}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {dreams.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No dreams yet</p>
            <p className="text-sm">Create your first homomorphically encrypted dream entry above!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dreams.map((dream) => (
              <div
                key={dream.id.toString()}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-gray-800 mb-1">
                      {dream.title}
                    </h4>
                    <p className="text-sm text-gray-500">
                      Created: {new Date(Number(dream.createdAt) * 1000).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDecryptDream(dream.id)}
                    disabled={dream.isDecrypting || isLoading}
                    className="ml-4 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {dream.isDecrypting
                      ? "FHE Decrypting..."
                      : dream.decryptedContent && showDecrypted[dream.id.toString()]
                      ? "Hide"
                      : "FHE Decrypt & View"}
                  </button>
                </div>
                
                {dream.decryptedContent && showDecrypted[dream.id.toString()] && (
                  <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm font-medium text-purple-800 mb-2">
                      FHE Decrypted Content:
                    </p>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {dream.decryptedContent}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FHEVM Status (Debug) */}
      {process.env.NODE_ENV === "development" && (
        <div className="bg-gray-100 rounded-lg p-4 text-xs text-gray-600">
          <p>Zama FHEVM Status: {fhevmStatus}</p>
          {fhevmError && <p>Error: {fhevmError.message}</p>}
        </div>
      )}
    </div>
  );
};
