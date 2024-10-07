import { useState, useEffect } from 'react';
import { ethers, BigNumber } from 'ethers';
import { useAccount } from 'wagmi';
import depositVaultAggregatorABI from '../../abis/DepositVaultsAggregator.json';
import riftExchangeABI from '../../abis/RiftExchange.json';
import { getDepositVaults, getDepositVaultsLength, getLiquidityProvider } from '../../utils/contractReadFunctions';
import { useStore } from '../../store';
import { useSwapReservations } from './useSwapReservations';
import { DepositVault, SwapReservation, ReservationState } from '../../types';
import { calculateFillPercentage } from '../../utils/dappHelper';
import { CONTRACT_RESERVATION_EXPIRATION_WINDOW_IN_SECONDS, FRONTEND_RESERVATION_EXPIRATION_WINDOW_IN_SECONDS } from '../../utils/constants';

type UseDepositVaultsResult = {
    allFetchedDepositVaults: DepositVault[];
    userActiveDepositVaults: DepositVault[];
    userCompletedDepositVaults: DepositVault[];
    allFetchedSwapReservations: SwapReservation[];
    loading: boolean;
    error: Error | null;
    refreshAllDepositData: () => Promise<void>;
};

export function useDepositVaults(): UseDepositVaultsResult {
    const { address, isConnected } = useAccount();
    const {
        allDepositVaults,
        setUserActiveDepositVaults,
        setUserCompletedDepositVaults,
        updateTotalAvailableLiquidity,
        setAllDepositVaults,
        setTotalExpiredReservations,
        setTotalUnlockedReservations,
        setCurrentlyExpiredReservationIndexes,
        setTotalCompletedReservations,
        selectedInputAsset,
    } = useStore();
    const ethersRpcProvider = useStore.getState().ethersRpcProvider;

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);
    const [refreshDepositVaults, setRefreshDepositVaults] = useState<boolean>(false);

    const { allSwapReservations: allFetchedSwapReservations, loading: swapReservationsLoading, error: swapReservationsError, refreshSwapReservations } = useSwapReservations();

    const calculateTrueUnreservedLiquidity = (depositVaults: DepositVault[], swapReservations: SwapReservation[]): DepositVault[] => {
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const additionalBalances = new Map<string, BigNumber>();
        const completedAmountsPerVault = new Map<string, BigNumber>();
        const provedAmountsPerVault = new Map<string, BigNumber>();
        const activelyReservedAmountsPerVault = new Map<string, BigNumber>();
        const expiredReservationIndexes: number[] = [];

        let activeReservationsCount = 0;
        let expiredReservationsCount = 0;
        let completedReservationsCount = 0;
        let provedReservationsCount = 0;

        // Process all reservations first (completed, expired, unlocked, active)
        swapReservations.forEach((reservation, reservationIndex) => {
            const isCreated = reservation.state === ReservationState.Created;
            const isProved = reservation.state === ReservationState.Proved;
            const isCompleted = reservation.state === ReservationState.Completed;
            const isExpiredOnChain = reservation.state === ReservationState.Expired;
            const isExpiredOffchain = reservation.state === ReservationState.Created && currentTimestamp - reservation.reservationTimestamp >= CONTRACT_RESERVATION_EXPIRATION_WINDOW_IN_SECONDS;

            if (reservation.indexInContract === 16) {
                console.log('help reservation.state from contract', reservation.state);
                console.log('help is this expired offchain', isExpiredOffchain);
            }

            if (isExpiredOffchain) {
                expiredReservationIndexes.push(reservationIndex);
            }

            if (isCompleted) {
                completedReservationsCount++;
            } else if (isProved) {
                provedReservationsCount++;
            } else if (isExpiredOnChain || isExpiredOffchain) {
                expiredReservationsCount++;
                reservation.stateOffChain = ReservationState.Expired;
            } else {
                // active reservations (created and not expired, completed, or unlocked)
                activeReservationsCount++;
            }

            if (reservation.indexInContract === 16) {
                console.log('reservation.indexInContract === 16', reservation);
                console.log('reservation.amountsToReserve', reservation.amountsToReserve);
                console.log('reservation.state', reservation.state);
                console.log('reservation.reservationTimestamp', reservation.reservationTimestamp);
                console.log('currentTimestamp', currentTimestamp);
                console.log('isExpiredOffchain', isExpiredOffchain);
                console.log('isExpiredOnChain', isExpiredOnChain);
                console.log('expiredReservationIndexes', expiredReservationIndexes);
                console.log('completedReservationsCount', completedReservationsCount);
            }

            const processVaultIndex = (vaultIndex, i) => {
                const vaultIndexKey = vaultIndex.toString();
                const amountToAdd = reservation.amountsToReserve[i];

                if (isCompleted) {
                    const currentCompleted = completedAmountsPerVault.get(vaultIndexKey) || BigNumber.from(0);
                    completedAmountsPerVault.set(vaultIndexKey, currentCompleted.add(amountToAdd));
                } else if (isProved) {
                    const currentUnlocked = provedAmountsPerVault.get(vaultIndexKey) || BigNumber.from(0);
                    provedAmountsPerVault.set(vaultIndexKey, currentUnlocked.add(amountToAdd));
                } else if (isExpiredOnChain || isExpiredOffchain) {
                    const currentAdditional = additionalBalances.get(vaultIndexKey) || BigNumber.from(0);
                    additionalBalances.set(vaultIndexKey, currentAdditional.add(amountToAdd));
                } else {
                    const currentActive = activelyReservedAmountsPerVault.get(vaultIndexKey) || BigNumber.from(0);
                    activelyReservedAmountsPerVault.set(vaultIndexKey, currentActive.add(amountToAdd));
                }
            };

            if (Array.isArray(reservation.vaultIndexes)) {
                reservation.vaultIndexes.forEach(processVaultIndex);
            } else {
                processVaultIndex(reservation.vaultIndexes, 0);
            }
        });

        setCurrentlyExpiredReservationIndexes(expiredReservationIndexes);
        setTotalExpiredReservations(expiredReservationsCount);
        setTotalCompletedReservations(completedReservationsCount);
        setTotalUnlockedReservations(provedReservationsCount);

        let totalAvailableLiquidity = BigNumber.from(0);

        // Now update the deposit vaults with the additional balances and active reservations
        const updatedVaults = depositVaults.map((vault, vaultIndex) => {
            const vaultIndexKey = vaultIndex.toString();
            const completedAmount = completedAmountsPerVault.get(vaultIndexKey) || BigNumber.from(0);
            const activelyReservedAmount = activelyReservedAmountsPerVault.get(vaultIndexKey) || BigNumber.from(0);
            let additionalBalance = additionalBalances.get(vaultIndexKey) ? additionalBalances.get(vaultIndexKey).sub(vault.withdrawnAmount).sub(activelyReservedAmount) : BigNumber.from(0);
            if (vaultIndex === 11) {
                console.log('vaultIndex === 11', vaultIndex);
                console.log('additionalBalance', additionalBalance.toString());
            }
            // Ensure additional balance can never be more than vault.initialBalance - completedAmount
            const unreservedBalance = vault.unreservedBalanceFromContract ?? BigNumber.from(0);
            const provedAmount = provedAmountsPerVault.get(vaultIndexKey) || BigNumber.from(0);
            const maxAdditionalBalance = BigNumber.from(vault.initialBalance).sub(completedAmount).sub(unreservedBalance);
            additionalBalance = additionalBalance.gt(maxAdditionalBalance) ? maxAdditionalBalance : additionalBalance;
            if (vaultIndex === 11) {
                console.log('additionalBalance', additionalBalance.toString());
                console.log('maxAdditionalBalance', maxAdditionalBalance.toString());
                console.log('unreservedBalance', unreservedBalance.toString());
            }

            totalAvailableLiquidity = totalAvailableLiquidity.add(unreservedBalance);

            if (vaultIndex === 11) {
                console.log(`Vault ${vaultIndex} data:`, {
                    unreservedBalance: unreservedBalance.toString(),
                    additionalBalance: additionalBalance.toString(),
                    completedAmount: completedAmount.toString(),
                    provedAmount: provedAmount.toString(),
                    activelyReservedAmount: activelyReservedAmount.toString(),
                    trueUnreservedBalance: BigNumber.from(unreservedBalance).add(BigNumber.from(additionalBalance)).toString(),
                    withdrawnAmount: vault.withdrawnAmount.toString(),
                });
            }

            return {
                ...vault,
                trueUnreservedBalance: BigNumber.from(unreservedBalance).add(BigNumber.from(additionalBalance)),
                activelyReservedAmount: activelyReservedAmount,
                depositAsset: selectedInputAsset,
                index: vaultIndex,
                completedAmount,
                provedAmount,
            };
        });

        updateTotalAvailableLiquidity(selectedInputAsset.name, totalAvailableLiquidity);

        return updatedVaults;
    };

    const fetchDepositVaultsReservationsData = async () => {
        if (!ethersRpcProvider || !selectedInputAsset.riftExchangeContractAddress) {
            setUserActiveDepositVaults([]);
            setUserCompletedDepositVaults([]);
            return;
        }

        try {
            // [0] fetch all deposit vaults
            const depositVaultsLength = await getDepositVaultsLength(ethersRpcProvider, riftExchangeABI.abi, selectedInputAsset.riftExchangeContractAddress);

            const bytecode = depositVaultAggregatorABI.bytecode;
            const abi = depositVaultAggregatorABI.abi;
            const depositVaults = await getDepositVaults(
                ethersRpcProvider,
                bytecode.object,
                abi,
                selectedInputAsset.riftExchangeContractAddress,
                Array.from({ length: depositVaultsLength }).map((_, i) => i),
            );

            const updatedDepositVaults = calculateTrueUnreservedLiquidity(depositVaults, allFetchedSwapReservations);
            console.log('All Updated Deposit Vaults:', updatedDepositVaults);

            setAllDepositVaults(updatedDepositVaults);

            // [1] fetch user-specific vaults (if connected)
            if (isConnected && address) {
                const result = await getLiquidityProvider(ethersRpcProvider, riftExchangeABI.abi, selectedInputAsset.riftExchangeContractAddress, address);

                const vaultIndexes = result.depositVaultIndexes.map((index) => BigNumber.from(index).toNumber());

                const userVaults = updatedDepositVaults.filter((_, index) => vaultIndexes.includes(BigNumber.from(index).toNumber()));

                const active: DepositVault[] = [];
                const completed: DepositVault[] = [];

                userVaults.forEach((vault) => {
                    const fillPercentage = calculateFillPercentage(vault);
                    if (fillPercentage < 100) {
                        active.push(vault);
                    } else {
                        completed.push(vault);
                    }
                });

                setUserActiveDepositVaults(active);
                setUserCompletedDepositVaults(completed);
            } else {
                setUserActiveDepositVaults([]);
                setUserCompletedDepositVaults([]);
            }
        } catch (err) {
            console.error('Error fetching deposit vaults data:', err);
            setError(err instanceof Error ? err : new Error('An unknown error occurred'));
        }
    };

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            if (isMounted) setLoading(true);
            if (isMounted) setError(null);

            try {
                // fetch all deposit vaults
                await fetchDepositVaultsReservationsData();
            } catch (err) {
                console.error('Error fetching data:', err);
                if (isMounted) setError(err instanceof Error ? err : new Error('An unknown error occurred'));
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (!swapReservationsLoading) {
            fetchData();
        }

        return () => {
            isMounted = false;
        };
    }, [ethersRpcProvider, selectedInputAsset.riftExchangeContractAddress, allFetchedSwapReservations, isConnected, address, swapReservationsLoading]);

    useEffect(() => {
        if (swapReservationsError) {
            setError(swapReservationsError);
        }
    }, [swapReservationsError]);

    useEffect(() => {
        refreshData();
    }, [refreshDepositVaults]);

    useEffect(() => {
        refreshSwapReservationData();
    }, []);

    const refreshData = async () => {
        try {
            await fetchDepositVaultsReservationsData();
        } catch (error) {
            console.error('Error refreshing user deposit data:', error);
        }
    };

    const refreshAllDepositData = async () => {
        setRefreshDepositVaults((prev) => !prev);
    };

    const refreshSwapReservationData = async () => {
        await refreshSwapReservations();
    };

    return {
        allFetchedDepositVaults: Array.isArray(allDepositVaults) ? allDepositVaults : [],
        userActiveDepositVaults: Array.isArray(useStore.getState().userActiveDepositVaults) ? useStore.getState().userActiveDepositVaults : [],
        userCompletedDepositVaults: Array.isArray(useStore.getState().userCompletedDepositVaults) ? useStore.getState().userCompletedDepositVaults : [],
        allFetchedSwapReservations,
        loading: loading || swapReservationsLoading,
        error,
        refreshAllDepositData,
    };
}
