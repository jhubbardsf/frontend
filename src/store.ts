import { create } from 'zustand';
import { useEffect } from 'react';
import { CurrencyModalTitle, DepositVault, ReserveLiquidityParams, SwapReservation } from './types';
import { BigNumber, ethers } from 'ethers';
import { USDT_Icon, ETH_Icon, ETH_Logo } from './components/other/SVGs';
import { ERC20ABI, requiredBlockConfirmations } from './utils/constants';
import { ValidAsset } from './types';
import riftExchangeABI from './abis/RiftExchange.json';
import arbitrumDeployment from '../contracts/broadcast/DeployRiftExchange.s.sol/42161/run-latest.json';
import { arbitrumSepolia, arbitrum } from 'viem/chains';

type Store = {
    // setup & asset data
    userEthAddress: string;
    setUserEthAddress: (address: string) => void;
    ethersRpcProvider: ethers.providers.Provider | null;
    setEthersRpcProvider: (provider: ethers.providers.Provider) => void;
    bitcoinPriceUSD: number;
    setBitcoinPriceUSD: (price: number) => void;
    validAssets: Record<string, ValidAsset>;
    setValidAssets: (assets: Record<string, ValidAsset>) => void;
    updateValidValidAsset: (assetKey: string, updates: Partial<ValidAsset>) => void;
    updateExchangeRateInTokenPerBTC: (assetKey: string, newRate: number) => void;
    updateExchangeRateInSmallestTokenUnitPerSat: (assetKey: string, newRate: BigNumber) => void;
    updatePriceUSD: (assetKey: string, newPrice: number) => void;
    updateTotalAvailableLiquidity: (assetKey: string, newLiquidity: BigNumber) => void;
    updateConnectedUserBalanceRaw: (assetKey: string, newBalance: BigNumber) => void;
    updateConnectedUserBalanceFormatted: (assetKey: string, newBalance: string) => void;
    selectedInputAsset: ValidAsset;
    setSelectedInputAsset: (asset: ValidAsset) => void;
    isPayingFeesInBTC: boolean;
    setIsPayingFeesInBTC: (isPayingFeesInBTC: boolean) => void;

    // contract data (deposit vaults, swap reservations)
    allDepositVaults: any;
    setAllDepositVaults: (allDepositVaults: DepositVault[]) => void;
    userActiveDepositVaults: DepositVault[];
    setUserActiveDepositVaults: (userActiveDepositVaults: DepositVault[]) => void;
    userCompletedDepositVaults: DepositVault[];
    setUserCompletedDepositVaults: (userCompletedDepositVaults: DepositVault[]) => void;
    allSwapReservations: SwapReservation[];
    setAllSwapReservations: (reservations: SwapReservation[]) => void;
    userSwapReservations: SwapReservation[];
    setUserSwapReservations: (reservations: SwapReservation[]) => void;
    totalExpiredReservations: number;
    setTotalExpiredReservations: (totalExpiredReservations: number) => void;
    totalUnlockedReservations: number;
    setTotalUnlockedReservations: (totalUnlockedReservations: number) => void;
    totalCompletedReservations: number;
    setTotalCompletedReservations: (totalCompletedReservations: number) => void;
    currentlyExpiredReservationIndexes: number[];
    setCurrentlyExpiredReservationIndexes: (indexes: number[]) => void;

    // manage deposits
    selectedVaultToManage: DepositVault | null;
    setSelectedVaultToManage: (vault: DepositVault | null) => void;
    showManageDepositVaultsScreen: boolean;
    setShowManageDepositVaultsScreen: (show: boolean) => void;

    // swap flow
    swapFlowState: '0-not-started' | '1-reserve-liquidity' | '2-send-bitcoin' | '3-receive-eth' | '4-completed' | '5-expired';
    setSwapFlowState: (state: '0-not-started' | '1-reserve-liquidity' | '2-send-bitcoin' | '3-receive-eth' | '4-completed' | '5-expired') => void;
    depositFlowState: '0-not-started' | '1-confirm-deposit';
    setDepositFlowState: (state: '0-not-started' | '1-confirm-deposit') => void;
    btcInputSwapAmount: string;
    setBtcInputSwapAmount: (amount: string) => void;
    usdtOutputSwapAmount: string;
    setUsdtOutputSwapAmount: (amount: string) => void;
    usdtDepositAmount: string;
    setUsdtDepositAmount: (amount: string) => void;
    btcOutputAmount: string;
    setBtcOutputAmount: (amount: string) => void;
    lowestFeeReservationParams: ReserveLiquidityParams | null;
    setLowestFeeReservationParams: (reservation: ReserveLiquidityParams | null) => void;
    showManageReservationScreen: boolean;
    setShowManageReservationScreen: (show: boolean) => void;
    depositMode: boolean;
    setDepositMode: (mode: boolean) => void;
    withdrawAmount: string;
    setWithdrawAmount: (amount: string) => void;
    reservationFeeAmountMicroUsdt: string;
    setReservationFeeAmountMicroUsdt: (amount: string) => void;
    swapReservationNotFound: boolean;
    setSwapReservationNotFound: (notFound: boolean) => void;
    currentReservationState: string;
    setCurrentReservationState: (state: string) => void;
    swapReservationData: SwapReservation | null;
    setSwapReservationData: (data: SwapReservation | null) => void;
    areNewDepositsPaused: boolean;
    setAreNewDepositsPaused: (paused: boolean) => void;
    isGasFeeTooHigh: boolean;
    setIsGasFeeTooHigh: (isGasFeeTooHigh: boolean) => void;
    confirmationBlocksNeeded: number;
    setConfirmationBlocksNeeded: (blocks: number) => void;
    currentTotalBlockConfirmations: number;
    setCurrentTotalBlockConfirmations: (confirmations: number) => void;

    // modals
    currencyModalTitle: CurrencyModalTitle;
    setCurrencyModalTitle: (x: CurrencyModalTitle) => void;
    ethPayoutAddress: string;
    setEthPayoutAddress: (address: string) => void;
    bitcoinSwapTransactionHash: string;
    setBitcoinSwapTransactionHash: (hash: string) => void;
};

export const useStore = create<Store>((set) => {
    const validAssets: Record<string, ValidAsset> = {
        BTC: {
            name: 'BTC',
            decimals: 8,
            icon_svg: null,
            bg_color: '#c26920',
            border_color: '#FFA04C',
            border_color_light: '#FFA04C',
            dark_bg_color: '#372412',
            light_text_color: '#7d572e',
            priceUSD: null,
        },
        USDT: {
            name: 'USDT',
            tokenAddress: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
            decimals: 6,
            riftExchangeContractAddress: arbitrumDeployment.transactions.find((tx) => tx.contractName === 'RiftExchange').contractAddress,
            riftExchangeAbi: riftExchangeABI.abi,
            contractChainID: 42161,
            chainDetails: arbitrum,
            contractRpcURL: 'https://arbitrum.gateway.tenderly.co/7BXjxEhRzB8b2jmcaZkNw9',
            etherScanBaseUrl: 'https://arbiscan.io/',
            paymasterUrl: 'https://rift-paymaster-arbitrum.up.railway.app',
            proverFee: BigNumber.from(19000000),
            releaserFee: BigNumber.from(1000000),
            icon_svg: USDT_Icon,
            bg_color: '#125641',
            border_color: '#26A17B',
            border_color_light: '#2DC495',
            dark_bg_color: '#08221A',
            light_text_color: '#327661',
            exchangeRateInTokenPerBTC: null,
            exchangeRateInSmallestTokenUnitPerSat: null, // always 18 decimals
            priceUSD: 1,
            totalAvailableLiquidity: BigNumber.from(0),
            connectedUserBalanceRaw: BigNumber.from(0),
            connectedUserBalanceFormatted: '0',
        },
        // WETH: {
        //     name: 'WETH',
        //     tokenAddress: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
        //     decimals: 18,
        //     riftExchangeContractAddress: '',
        //     riftExchangeAbi: riftExchangeABI.abi,
        //     contractChainID: 421614,
        //     contractRpcURL: 'https://holesky.gateway.tenderly.co/2inf5WqfawBiK0LyN8veXn',
        //     icon_svg: ETH_Logo,
        //     bg_color: '#2E40B7',
        //     border_color: '#627EEA',
        //     border_color_light: '#6E85F0',
        //     dark_bg_color: '#161A33',
        //     light_text_color: '#5b63a5',
        //     exchangeRateInTokenPerBTC: null,
        //     exchangeRateInSmallestTokenUnitPerSat: null, // always 18 decimals
        //     priceUSD: null,
        //     totalAvailableLiquidity: BigNumber.from(0),
        //     connectedUserBalanceRaw: BigNumber.from(0),
        //     connectedUserBalanceFormatted: '0',
        // },
    };

    return {
        // setup & asset data
        userEthAddress: '',
        setUserEthAddress: (userEthAddress) => set({ userEthAddress }),
        //console log the new ethers provider
        ethersRpcProvider: null,
        setEthersRpcProvider: (provider) => set({ ethersRpcProvider: provider }),
        bitcoinPriceUSD: 0,
        setBitcoinPriceUSD: (bitcoinPriceUSD) => set({ bitcoinPriceUSD }),
        validAssets,
        setValidAssets: (assets) => set({ validAssets: assets }),
        updateValidValidAsset: (assetKey, updates) =>
            set((state) => ({
                validAssets: {
                    ...state.validAssets,
                    [assetKey]: { ...state.validAssets[assetKey], ...updates },
                },
            })),
        updateExchangeRateInTokenPerBTC: (assetKey, newRate) =>
            set((state) => ({
                validAssets: {
                    ...state.validAssets,
                    [assetKey]: { ...state.validAssets[assetKey], exchangeRateInTokenPerBTC: newRate },
                },
            })),
        updateExchangeRateInSmallestTokenUnitPerSat: (assetKey, newRate) =>
            set((state) => ({
                validAssets: {
                    ...state.validAssets,
                    [assetKey]: { ...state.validAssets[assetKey], exchangeRateInSmallestTokenUnitPerSat: newRate },
                },
            })),
        updatePriceUSD: (assetKey, newPrice) =>
            set((state) => ({
                validAssets: {
                    ...state.validAssets,
                    [assetKey]: { ...state.validAssets[assetKey], priceUSD: newPrice },
                },
            })),
        updateTotalAvailableLiquidity: (assetKey, newLiquidity) =>
            set((state) => ({
                validAssets: {
                    ...state.validAssets,
                    [assetKey]: { ...state.validAssets[assetKey], totalAvailableLiquidity: newLiquidity },
                },
            })),
        updateConnectedUserBalanceRaw: (assetKey, newBalance) =>
            set((state) => ({
                validAssets: {
                    ...state.validAssets,
                    [assetKey]: { ...state.validAssets[assetKey], connectedUserBalanceRaw: newBalance },
                },
            })),
        updateConnectedUserBalanceFormatted: (assetKey, newBalance) =>
            set((state) => ({
                validAssets: {
                    ...state.validAssets,
                    [assetKey]: { ...state.validAssets[assetKey], connectedUserBalanceFormatted: newBalance },
                },
            })),
        selectedInputAsset: validAssets.USDT,
        setSelectedInputAsset: (selectedInputAsset) => set({ selectedInputAsset }),
        isPayingFeesInBTC: true,
        setIsPayingFeesInBTC: (isPayingFeesInBTC) => set({ isPayingFeesInBTC }),

        // contract data (deposit vaults, swap reservations)
        allDepositVaults: {},
        setAllDepositVaults: (allDepositVaults) => set({ allDepositVaults }),
        userActiveDepositVaults: [],
        setUserActiveDepositVaults: (userActiveDepositVaults) => set({ userActiveDepositVaults }),
        userCompletedDepositVaults: [],
        setUserCompletedDepositVaults: (userCompletedDepositVaults) => set({ userCompletedDepositVaults }),
        allSwapReservations: [],
        setAllSwapReservations: (allSwapReservations) => set({ allSwapReservations }),
        userSwapReservations: [],
        setUserSwapReservations: (userSwapReservations) => set({ userSwapReservations }),
        totalExpiredReservations: 0,
        setTotalExpiredReservations: (totalExpiredReservations) => set({ totalExpiredReservations }),
        totalUnlockedReservations: 0,
        setTotalUnlockedReservations: (totalUnlockedReservations) => set({ totalUnlockedReservations }),
        totalCompletedReservations: 0,
        setTotalCompletedReservations: (totalCompletedReservations) => set({ totalCompletedReservations }),
        currentlyExpiredReservationIndexes: [],
        setCurrentlyExpiredReservationIndexes: (currentlyExpiredReservationIndexes) => set({ currentlyExpiredReservationIndexes }),

        // manage deposits
        selectedVaultToManage: null,
        setSelectedVaultToManage: (selectedVaultToManage) => set({ selectedVaultToManage }),
        showManageDepositVaultsScreen: false,
        setShowManageDepositVaultsScreen: (showManageDepositVaultsScreen) => set({ showManageDepositVaultsScreen }),

        // swap flow
        swapFlowState: '0-not-started',
        setSwapFlowState: (swapFlowState) => set({ swapFlowState }),
        depositFlowState: '0-not-started',
        setDepositFlowState: (depositFlowState) => set({ depositFlowState }),
        btcInputSwapAmount: '',
        setBtcInputSwapAmount: (btcInputSwapAmount) => set({ btcInputSwapAmount }),
        usdtOutputSwapAmount: '',
        setUsdtOutputSwapAmount: (usdtOutputSwapAmount) => set({ usdtOutputSwapAmount }),
        usdtDepositAmount: '',
        setUsdtDepositAmount: (usdtDepositAmount) => set({ usdtDepositAmount }),
        btcOutputAmount: '',
        setBtcOutputAmount: (btcOutputAmount) => set({ btcOutputAmount }),
        lowestFeeReservationParams: null,
        setLowestFeeReservationParams: (lowestFeeReservationParams) => set({ lowestFeeReservationParams }),
        showManageReservationScreen: false,
        setShowManageReservationScreen: (showManageReservationScreen) => set({ showManageReservationScreen }),
        depositMode: false,
        setDepositMode: (depositMode) => set({ depositMode }),
        withdrawAmount: '',
        setWithdrawAmount: (withdrawAmount) => set({ withdrawAmount }),
        currencyModalTitle: 'close',
        setCurrencyModalTitle: (x) => set({ currencyModalTitle: x }),
        ethPayoutAddress: '',
        setEthPayoutAddress: (ethPayoutAddress) => set({ ethPayoutAddress }),
        bitcoinSwapTransactionHash: '',
        setBitcoinSwapTransactionHash: (bitcoinSwapTransactionHash) => set({ bitcoinSwapTransactionHash }),
        reservationFeeAmountMicroUsdt: '',
        setReservationFeeAmountMicroUsdt: (reservationFeeAmountMicroUsdt) => set({ reservationFeeAmountMicroUsdt }),
        swapReservationNotFound: false,
        setSwapReservationNotFound: (swapReservationNotFound) => set({ swapReservationNotFound }),
        currentReservationState: '',
        setCurrentReservationState: (currentReservationState) => set({ currentReservationState }),
        swapReservationData: null,
        setSwapReservationData: (swapReservationData) => set({ swapReservationData }),
        areNewDepositsPaused: false,
        setAreNewDepositsPaused: (areNewDepositsPaused) => set({ areNewDepositsPaused }),
        isGasFeeTooHigh: false,
        setIsGasFeeTooHigh: (isGasFeeTooHigh) => set({ isGasFeeTooHigh }),
        confirmationBlocksNeeded: requiredBlockConfirmations,
        setConfirmationBlocksNeeded: (confirmationBlocksNeeded) => set({ confirmationBlocksNeeded }),
        currentTotalBlockConfirmations: 0,
        setCurrentTotalBlockConfirmations: (currentTotalBlockConfirmations) => set({ currentTotalBlockConfirmations }),
    };
});
