import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Plus,
    Edit,
    Trash2,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Search,
    AlertCircle,
    Activity,
    DollarSign
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "../services/api";

type SortField = 'symbol' | 'secType' | 'currency' | 'quantity' | 'averageCost' | 'marketPrice' | 'pnlPercent' | 'unrealizedPnl' | 'marketValue' | 'country' | 'industry' | 'category' | 'dayChange' | 'dayChangePercent' | 'account';
type SortDirection = 'asc' | 'desc';

interface ManualPosition {
    id: number;
    mainAccountId: number; // References main accounts table
    symbol: string;
    secType: string;
    currency: string;
    country?: string;
    industry?: string;
    category?: string;
    quantity: number;
    averageCost: number;
    exchange?: string;
    primaryExchange?: string;
    marketPrice?: number;
    marketValue?: number;
    dayChange?: number;
    dayChangePercent?: number;
    closePrice?: number;
    unrealizedPnl?: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    lastPriceUpdate?: string;
    accountName?: string; // Will be populated from main accounts
}

interface SymbolSearchResult {
    symbol: string;
    name: string;
    type: string;
    exchange: string;
}

interface MainAccount {
    id: number;
    userId: number;
    name: string;
    currency: string;
    originalCapital: number;
    currentBalance: number;
    lastUpdated: string;
    createdAt: string;
    updatedAt: string;
    profitLoss: number;
    profitLossPercent: number;
}

interface CashBalance {
    id: number;
    mainAccountId: number;
    currency: string;
    amount: number;
    marketValueHKD: number;
    marketValueUSD: number;
    lastUpdated: string;
    createdAt: string;
    updatedAt: string;
    accountName: string;
}

interface OtherPortfolioViewProps {
    accounts: MainAccount[];
}

// Cash Balances Section Component
const CashBalancesSection: React.FC<{ accounts: MainAccount[] }> = ({ accounts }) => {
    const { toast } = useToast();
    const [cashBalances, setCashBalances] = useState<CashBalance[]>([]);
    const [loading, setLoading] = useState(false);
    const [cashDialogOpen, setCashDialogOpen] = useState(false);
    const [editingCashBalance, setEditingCashBalance] = useState<CashBalance | null>(null);
    const [cashForm, setCashForm] = useState({
        accountId: '',
        currency: 'USD',
        amount: ''
    });

    useEffect(() => {
        loadCashBalances();
    }, []);

    const loadCashBalances = async () => {
        try {
            setLoading(true);
            const response = await apiClient.getCashBalances();
            if (response.data) {
                setCashBalances(response.data);
            }
        } catch (error) {
            console.error('Error loading cash balances:', error);
            toast({
                title: "Error",
                description: "Failed to load cash balances",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCashBalance = async () => {
        try {
            if (!cashForm.accountId || !cashForm.currency || !cashForm.amount) {
                toast({
                    title: "Validation Error",
                    description: "Please fill in all required fields",
                    variant: "destructive",
                });
                return;
            }

            const response = await apiClient.createCashBalance({
                accountId: parseInt(cashForm.accountId),
                currency: cashForm.currency,
                amount: parseFloat(cashForm.amount)
            });

            if (response.data) {
                toast({
                    title: "Success",
                    description: "Cash balance added successfully",
                });
                await loadCashBalances();
                setCashDialogOpen(false);
                resetCashForm();
            } else {
                toast({
                    title: "Error",
                    description: response.error || 'Failed to add cash balance',
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error('Error creating cash balance:', error);
            toast({
                title: "Error",
                description: 'Failed to add cash balance',
                variant: "destructive",
            });
        }
    };

    const handleUpdateCashBalance = async () => {
        if (!editingCashBalance) return;

        try {
            const response = await apiClient.updateCashBalance(editingCashBalance.id, {
                currency: cashForm.currency,
                amount: parseFloat(cashForm.amount)
            });

            if (response.data) {
                toast({
                    title: "Success",
                    description: "Cash balance updated successfully",
                });
                await loadCashBalances();
                setCashDialogOpen(false);
                setEditingCashBalance(null);
                resetCashForm();
            } else {
                toast({
                    title: "Error",
                    description: response.error || 'Failed to update cash balance',
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error('Error updating cash balance:', error);
            toast({
                title: "Error",
                description: 'Failed to update cash balance',
                variant: "destructive",
            });
        }
    };

    const handleDeleteCashBalance = async (cashBalanceId: number) => {
        if (!confirm('Are you sure you want to delete this cash balance?')) {
            return;
        }

        try {
            const response = await apiClient.deleteCashBalance(cashBalanceId);
            if (response.data) {
                toast({
                    title: "Success",
                    description: "Cash balance deleted successfully",
                });
                await loadCashBalances();
            } else {
                toast({
                    title: "Error",
                    description: response.error || 'Failed to delete cash balance',
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error('Error deleting cash balance:', error);
            toast({
                title: "Error",
                description: 'Failed to delete cash balance',
                variant: "destructive",
            });
        }
    };

    const openEditCashBalance = (cashBalance: CashBalance) => {
        setEditingCashBalance(cashBalance);
        setCashForm({
            accountId: cashBalance.mainAccountId.toString(),
            currency: cashBalance.currency,
            amount: cashBalance.amount.toString()
        });
        setCashDialogOpen(true);
    };

    const resetCashForm = () => {
        setCashForm({
            accountId: '',
            currency: 'USD',
            amount: ''
        });
    };

    const formatCurrency = (value: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(value);
    };

    // Calculate totals
    const totalUSD = cashBalances.reduce((sum, cb) => sum + cb.marketValueUSD, 0);
    const totalHKD = cashBalances.reduce((sum, cb) => sum + cb.marketValueHKD, 0);

    return (
        <>
            <div className="flex items-center gap-4 mb-4 px-4 sm:px-0">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Cash Balances
                </h3>
                {cashBalances.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                        Market Value (USD): <span className="font-medium text-foreground">{formatCurrency(totalUSD, 'USD')}</span>
                    </div>
                )}
                <Button onClick={() => setCashDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Cash Balance
                </Button>
            </div>
            {cashBalances.length > 0 ? (
                <div className="overflow-x-auto">
                    <Table className="text-sm w-auto">
                        <TableHeader>
                            <TableRow className="text-xs">
                                <TableHead className="px-3 text-left">Account</TableHead>
                                <TableHead className="px-3 text-left">Currency</TableHead>
                                <TableHead className="px-3 text-right">Amount</TableHead>
                                <TableHead className="px-3 text-right">Market Value (USD)</TableHead>
                                <TableHead className="px-3 text-right">Market Value (HKD)</TableHead>
                                <TableHead className="px-3 text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {cashBalances.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No cash balances found. Click "Add Cash Balance" to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {cashBalances.map((cashBalance) => (
                                        <TableRow key={cashBalance.id} className="text-xs">
                                            <TableCell className="font-medium px-3">
                                                {cashBalance.accountName}
                                            </TableCell>
                                            <TableCell className="px-3">
                                                {cashBalance.currency}
                                            </TableCell>
                                            <TableCell className="text-right px-3 whitespace-nowrap">
                                                {formatCurrency(cashBalance.amount, cashBalance.currency)}
                                            </TableCell>
                                            <TableCell className="text-right px-3 whitespace-nowrap">
                                                {formatCurrency(cashBalance.marketValueUSD, 'USD')}
                                            </TableCell>
                                            <TableCell className="text-right px-3 whitespace-nowrap">
                                                {formatCurrency(cashBalance.marketValueHKD, 'HKD')}
                                            </TableCell>
                                            <TableCell className="text-center px-3">
                                                <div className="flex gap-1 justify-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => openEditCashBalance(cashBalance)}
                                                        title="Edit Cash Balance"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                                        onClick={() => handleDeleteCashBalance(cashBalance.id)}
                                                        title="Delete Cash Balance"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {/* Totals Row */}
                                    <TableRow className="bg-muted/50 font-semibold border-t-2 text-xs">
                                        <TableCell className="text-left font-bold px-3">
                                            Total:
                                        </TableCell>
                                        <TableCell className="px-3"></TableCell>
                                        <TableCell className="px-3"></TableCell>
                                        <TableCell className="text-right font-bold px-3 whitespace-nowrap">
                                            {formatCurrency(totalUSD, 'USD')}
                                        </TableCell>
                                        <TableCell className="text-right font-bold px-3 whitespace-nowrap">
                                            {formatCurrency(totalHKD, 'HKD')}
                                        </TableCell>
                                        <TableCell className="px-3"></TableCell>
                                    </TableRow>
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-background/30 rounded-lg">
                    <DollarSign className="h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="text-base font-medium text-foreground mb-1">No Cash Balances</h3>
                    <p className="text-sm text-muted-foreground">
                        Click "Add Cash Balance" to get started
                    </p>
                </div>
            )}

            {/* Cash Balance Dialog */}
                <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
                    <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle>
                                {editingCashBalance ? 'Edit Cash Balance' : 'Add Cash Balance'}
                            </DialogTitle>
                            <DialogDescription>
                                {editingCashBalance ? 'Update cash balance information' : 'Add a new cash balance for an investment account'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="account">Account</Label>
                                <Select 
                                    value={cashForm.accountId} 
                                    onValueChange={(value) => setCashForm({ ...cashForm, accountId: value })}
                                    disabled={!!editingCashBalance}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((account) => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                {account.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="currency">Currency</Label>
                                <Select 
                                    value={cashForm.currency} 
                                    onValueChange={(value) => setCashForm({ ...cashForm, currency: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select currency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="HKD">HKD</SelectItem>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                        <SelectItem value="GBP">GBP</SelectItem>
                                        <SelectItem value="JPY">JPY</SelectItem>
                                        <SelectItem value="CNY">CNY</SelectItem>
                                        <SelectItem value="SGD">SGD</SelectItem>
                                        <SelectItem value="CAD">CAD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    value={cashForm.amount}
                                    onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                                    placeholder="10000.00"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => {
                                setCashDialogOpen(false);
                                setEditingCashBalance(null);
                                resetCashForm();
                            }}>
                                Cancel
                            </Button>
                            <Button onClick={editingCashBalance ? handleUpdateCashBalance : handleCreateCashBalance}>
                                {editingCashBalance ? 'Update' : 'Add'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
        </>
    );
};

const OtherPortfolioView: React.FC<OtherPortfolioViewProps> = ({ accounts = [] }) => {
    const { toast } = useToast();
    const [positions, setPositions] = useState<ManualPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshStatus, setRefreshStatus] = useState<{
        lastRefreshTime: string | null;
        timeSinceLastRefresh: number | null;
        nextAutoRefresh: string | null;
        autoRefreshEnabled: boolean;
    } | null>(null);
    const [allLastUpdateTimes, setAllLastUpdateTimes] = useState<{
        currency: string | null;
        ibPortfolio: string | null;
        manualInvestments: string | null;
    } | null>(null);

    // Dialog states
    const [positionDialogOpen, setPositionDialogOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<ManualPosition | null>(null);

    const [positionForm, setPositionForm] = useState({
        accountId: '',
        symbol: '',
        secType: 'STK' as const,
        currency: 'USD',
        country: '',
        industry: '',
        category: '',
        quantity: '',
        averageCost: '',
        marketPrice: '',
        exchange: '',
        primaryExchange: ''
    });

    const [symbolSearchResults, setSymbolSearchResults] = useState<SymbolSearchResult[]>([]);
    const [symbolSearchLoading, setSymbolSearchLoading] = useState(false);

    // Sorting state
    const [sortField, setSortField] = useState<SortField>('symbol');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    
    // Action popover state for click-based interaction
    const [openActionPopover, setOpenActionPopover] = useState<number | null>(null);





    const securityTypes = [
        { value: 'STK', label: 'Stock' },
        { value: 'ETF', label: 'ETF' },
        { value: 'MUTUAL_FUND', label: 'Mutual Fund' },
        { value: 'BOND', label: 'Bond' },
        { value: 'CRYPTO', label: 'Cryptocurrency' },
        { value: 'OTHER', label: 'Other' }
    ];

    useEffect(() => {
        loadPositions();
        loadRefreshStatus();
        loadAllLastUpdateTimes();
        
        // Set up interval to update refresh status every minute
        const statusInterval = setInterval(() => {
            loadRefreshStatus();
            loadAllLastUpdateTimes();
        }, 60000);
        
        return () => clearInterval(statusInterval);
    }, []);

    const loadRefreshStatus = async () => {
        try {
            const response = await apiClient.getManualInvestmentRefreshStatus();
            if (response.data) {
                setRefreshStatus(response.data);
            }
        } catch (error) {
            console.error('Error loading refresh status:', error);
        }
    };

    const loadAllLastUpdateTimes = async () => {
        try {
            const response = await apiClient.getAllLastUpdateTimes();
            if (response.data) {
                setAllLastUpdateTimes(response.data);
            }
        } catch (error) {
            console.error('Error loading all last update times:', error);
        }
    };

    const loadPositions = async () => {
        try {
            setLoading(true);
            const response = await apiClient.getManualPositions();
            if (response.data) {
                setPositions(response.data);
                setError(null); // Clear any previous errors
            } else if (response.error) {
                setError(response.error);
                setPositions([]); // Set empty array to show empty state
            }
        } catch (error) {
            console.error('Error loading positions:', error);
            setError('Failed to load positions');
        } finally {
            setLoading(false);
        }
    };



    const handleCreatePosition = async () => {
        try {
            // Validate required fields
            if (!positionForm.accountId || !positionForm.symbol || !positionForm.secType || 
                !positionForm.quantity || !positionForm.averageCost) {
                toast({
                    title: "Validation Error",
                    description: "Please fill in all required fields: Account, Symbol, Security Type, Quantity, and Average Cost",
                    variant: "destructive",
                });
                return;
            }

            console.log('Creating position with data:', positionForm);

            const response = await fetch('/api/manual-investments/positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...positionForm,
                    quantity: parseFloat(positionForm.quantity),
                    averageCost: parseFloat(positionForm.averageCost)
                })
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Position created successfully",
                });
                await loadPositions();
                // Don't auto-refresh market data when creating position
                setPositionDialogOpen(false);
                resetPositionForm();
            } else {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                toast({
                    title: "Error",
                    description: errorData.error || 'Failed to create position',
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error('Error creating position:', error);
            toast({
                title: "Error",
                description: 'Failed to create position',
                variant: "destructive",
            });
        }
    };

    const handleUpdatePosition = async () => {
        if (!editingPosition) return;

        try {
            const response = await fetch(`/api/manual-investments/positions/${editingPosition.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...positionForm,
                    quantity: parseFloat(positionForm.quantity),
                    averageCost: parseFloat(positionForm.averageCost),
                    marketPrice: positionForm.marketPrice ? parseFloat(positionForm.marketPrice) : undefined
                })
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Position updated successfully",
                });
                await loadPositions();
                // Don't auto-refresh market data when updating position
                setPositionDialogOpen(false);
                setEditingPosition(null);
                resetPositionForm();
            } else {
                const errorData = await response.json();
                toast({
                    title: "Error",
                    description: errorData.error || 'Failed to update position',
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error('Error updating position:', error);
            toast({
                title: "Error",
                description: 'Failed to update position',
                variant: "destructive",
            });
        }
    };

    const handleDeletePosition = async (positionId: number) => {
        if (!confirm('Are you sure you want to delete this position?')) {
            return;
        }

        try {
            const response = await fetch(`/api/manual-investments/positions/${positionId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await loadPositions();
            } else {
                setError('Failed to delete position');
            }
        } catch (error) {
            console.error('Error deleting position:', error);
            setError('Failed to delete position');
        }
    };

    const handleRefreshMarketData = async () => {
        try {
            setLoading(true);
            const response = await apiClient.refreshManualMarketData('default');

            if (response.data) {
                toast({
                    title: "Success",
                    description: `Updated ${response.data.updated} positions, ${response.data.failed} failed`,
                });
                await loadPositions();
                await loadRefreshStatus(); // Update refresh status
                await loadAllLastUpdateTimes(); // Update all last update times
            } else {
                setError(response.error || 'Failed to refresh market data');
            }
        } catch (error) {
            console.error('Error refreshing market data:', error);
            setError('Failed to refresh market data');
        } finally {
            setLoading(false);
        }
    };

    const searchSymbols = async (query: string) => {
        if (query.length < 1) {
            setSymbolSearchResults([]);
            return;
        }

        try {
            setSymbolSearchLoading(true);
            const response = await fetch(`/api/manual-investments/search-symbols?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const results = await response.json();
                setSymbolSearchResults(results);
            }
        } catch (error) {
            console.error('Error searching symbols:', error);
        } finally {
            setSymbolSearchLoading(false);
        }
    };

    const fetchYahooFinanceData = async (symbol: string) => {
        if (!symbol || symbol.length < 1) return;

        try {
            console.log(`Fetching Yahoo Finance data for ${symbol}...`);
            const response = await fetch(`/api/manual-investments/market-data/${encodeURIComponent(symbol)}`);
            if (response.ok) {
                const marketData = await response.json();
                console.log('Yahoo Finance data:', marketData);
                
                // Update form with Yahoo Finance data
                setPositionForm(prev => ({
                    ...prev,
                    secType: marketData.secType || prev.secType,
                    currency: marketData.currency || prev.currency,
                    averageCost: marketData.marketPrice ? marketData.marketPrice.toString() : prev.averageCost,
                    marketPrice: marketData.marketPrice ? marketData.marketPrice.toString() : prev.marketPrice,
                    country: marketData.country || prev.country,
                    industry: marketData.industry || prev.industry,
                    category: marketData.sector || prev.category,
                    exchange: marketData.exchange || prev.exchange
                }));
                
                toast({
                    title: "Success",
                    description: `Updated fields with data for ${symbol}`,
                });
            }
        } catch (error) {
            console.error('Error fetching Yahoo Finance data:', error);
            toast({
                title: "Warning",
                description: `Could not fetch data for ${symbol}`,
                variant: "destructive",
            });
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortedPositions = () => {
        return [...positions].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortField) {
                case 'account':
                    aValue = accounts.find(acc => acc.id === a.mainAccountId)?.name || '';
                    bValue = accounts.find(acc => acc.id === b.mainAccountId)?.name || '';
                    break;
                case 'pnlPercent':
                    // Calculate P&L percentage for sorting
                    const aPnlPercent = a.marketValue && a.marketValue > 0 
                        ? ((a.unrealizedPnl || 0) / (a.marketValue - (a.unrealizedPnl || 0))) * 100 
                        : 0;
                    const bPnlPercent = b.marketValue && b.marketValue > 0 
                        ? ((b.unrealizedPnl || 0) / (b.marketValue - (b.unrealizedPnl || 0))) * 100 
                        : 0;
                    aValue = aPnlPercent;
                    bValue = bPnlPercent;
                    break;
                case 'quantity':
                    aValue = a.quantity || 0;
                    bValue = b.quantity || 0;
                    break;
                case 'averageCost':
                    aValue = a.averageCost || 0;
                    bValue = b.averageCost || 0;
                    break;
                case 'marketPrice':
                    aValue = a.marketPrice || 0;
                    bValue = b.marketPrice || 0;
                    break;
                case 'unrealizedPnl':
                    aValue = a.unrealizedPnl || 0;
                    bValue = b.unrealizedPnl || 0;
                    break;
                case 'marketValue':
                    aValue = a.marketValue || 0;
                    bValue = b.marketValue || 0;
                    break;
                case 'dayChange':
                    aValue = a.dayChange || 0;
                    bValue = b.dayChange || 0;
                    break;
                case 'dayChangePercent':
                    aValue = a.dayChangePercent || 0;
                    bValue = b.dayChangePercent || 0;
                    break;
                default:
                    aValue = a[sortField] || '';
                    bValue = b[sortField] || '';
            }

            if (typeof aValue === 'string') {
                return sortDirection === 'asc' 
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        });
    };

    const resetPositionForm = () => {
        setPositionForm({
            accountId: '',
            symbol: '',
            secType: 'STK',
            currency: 'USD',
            country: '',
            industry: '',
            category: '',
            quantity: '',
            averageCost: '',
            marketPrice: '',
            exchange: '',
            primaryExchange: ''
        });
    };



    const openEditPosition = (position: ManualPosition) => {
        setEditingPosition(position);
        setPositionForm({
            accountId: position.mainAccountId.toString(),
            symbol: position.symbol,
            secType: position.secType as any,
            currency: position.currency,
            country: position.country || '',
            industry: position.industry || '',
            category: position.category || '',
            quantity: position.quantity.toString(),
            averageCost: position.averageCost.toString(),
            marketPrice: (position.marketPrice || 0).toString(),
            exchange: position.exchange || '',
            primaryExchange: position.primaryExchange || ''
        });
        setPositionDialogOpen(true);
    };

    const formatCurrency = (value: number | undefined, currency: string = 'USD') => {
        if (value === undefined || value === null) return '-';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(value);
    };

    const formatPercent = (value: number | undefined) => {
        if (value === undefined || value === null) return '-';
        return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    };

    const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
        <div 
            className="cursor-pointer hover:bg-muted/50 select-none flex items-center gap-1"
            onClick={() => handleSort(field)}
        >
            {children}
            {sortField === field && (
                <span className="text-xs">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
            )}
        </div>
    );

    // Show loading or error state if no accounts available
    if (!accounts || accounts.length === 0) {
        return (
            <div className="space-y-6">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        No investment accounts found. Please create an investment account first in the Accounts section.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Other Portfolio Overview */}
            <Card className="bg-gradient-card border-border shadow-card">
                <CardHeader>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-primary" />
                                Other Portfolio
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={handleRefreshMarketData} disabled={loading} size="sm">
                                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                    {loading ? 'Refreshing...' : 'Refresh Market Data'}
                                </Button>
                                <Button onClick={() => setPositionDialogOpen(true)} size="sm">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Position
                                </Button>
                            </div>
                        </div>
                        <CardDescription>
                            Manual investment positions and cash balances{allLastUpdateTimes && allLastUpdateTimes.manualInvestments && ` (Last updated: ${new Date(allLastUpdateTimes.manualInvestments).toLocaleString()})`}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 px-4 sm:px-6">
                    {/* Portfolio Positions */}
                    <div className="border-t pt-6 -mx-4 sm:mx-0">
                        <div className="flex items-center justify-between mb-4 px-4 sm:px-0">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-primary" />
                                    Positions
                                </h3>
                            </div>
                            <p className="text-xs text-muted-foreground sm:hidden">
                                Scroll →
                            </p>
                        </div>
                        {positions.length > 0 ? (
                            <div className="w-full overflow-x-auto">
                    <Table className="w-full text-sm">
                        <TableHeader>
                            <TableRow className="text-xs">
                                <TableHead className="sticky left-0 z-10 border-r px-2 w-20 min-w-[80px] bg-background">
                                    <SortableHeader field="symbol">Symbol</SortableHeader>
                                </TableHead>
                                <TableHead className="px-2 w-20">
                                    <SortableHeader field="dayChangePercent">
                                        <div className="text-right w-full">
                                            <div>Chg</div>
                                            <div>Chg %</div>
                                        </div>
                                    </SortableHeader>
                                </TableHead>
                                <TableHead className="px-2 w-24">
                                    <SortableHeader field="averageCost">
                                        <div className="text-right w-full">Avg Cost</div>
                                    </SortableHeader>
                                </TableHead>
                                <TableHead className="px-2 w-16">
                                    <SortableHeader field="quantity">
                                        <div className="text-right w-full">Qty</div>
                                    </SortableHeader>
                                </TableHead>
                                <TableHead className="px-2 w-24">
                                    <SortableHeader field="marketPrice">
                                        <div className="text-right w-full">Current Price</div>
                                    </SortableHeader>
                                </TableHead>
                                <TableHead className="px-2 w-24">
                                    <SortableHeader field="pnlPercent">
                                        <div className="text-right w-full">
                                            <div>Unrealized P&L</div>
                                            <div>P&L %</div>
                                        </div>
                                    </SortableHeader>
                                </TableHead>
                                <TableHead className="px-2 w-24">
                                    <div className="text-right w-full">P&L (HKD)</div>
                                </TableHead>
                                <TableHead className="px-2 w-28">
                                    <SortableHeader field="marketValue">
                                        <div className="text-right w-full">Market Value (HKD)</div>
                                    </SortableHeader>
                                </TableHead>
                                <TableHead className="px-2 w-20">
                                    <SortableHeader field="account">
                                        <div className="text-center w-full">Account</div>
                                    </SortableHeader>
                                </TableHead>
                                <TableHead className="px-2 w-16">
                                    <SortableHeader field="secType">
                                        <div className="text-center w-full">Type</div>
                                    </SortableHeader>
                                </TableHead>
                                <TableHead className="px-2 w-20">
                                    <SortableHeader field="country">
                                        <div className="text-center w-full">Country</div>
                                    </SortableHeader>
                                </TableHead>
                                <TableHead className="px-2 w-24">
                                    <SortableHeader field="industry">
                                        <div className="text-center w-full">Industry</div>
                                    </SortableHeader>
                                </TableHead>
                                <TableHead className="px-2 w-24">
                                    <SortableHeader field="category">
                                        <div className="text-center w-full">Category</div>
                                    </SortableHeader>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {positions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                                        No positions found. Click "Add Position" to get started.
                                    </TableCell>
                                </TableRow>
                            ) : getSortedPositions().map((position) => {
                                const isPositive = (position.unrealizedPnl || 0) >= 0;
                                const isDayChangePositive = (position.dayChange || 0) >= 0;
                                const pnlPercentage = (() => {
                                    if (!position.marketValue || position.marketValue <= 0) return 0;
                                    const costBasis = position.marketValue - (position.unrealizedPnl || 0);
                                    if (costBasis <= 0) return 0;
                                    const percentage = ((position.unrealizedPnl || 0) / costBasis) * 100;
                                    return isFinite(percentage) ? percentage : 0;
                                })();
                                
                                // Convert to HKD (assuming 1:1 for now, should use exchange rates in real implementation)
                                const convertToHKD = (amount: number | undefined, currency: string) => {
                                    if (!amount) return 0;
                                    // Simple conversion - in real app, use actual exchange rates
                                    const rates: Record<string, number> = {
                                        'USD': 7.8,
                                        'EUR': 8.5,
                                        'GBP': 10.0,
                                        'HKD': 1,
                                        'CNY': 1.1,
                                        'JPY': 0.05
                                    };
                                    return amount * (rates[currency] || 1);
                                };
                                
                                const pnlInHKD = convertToHKD(position.unrealizedPnl, position.currency);
                                const marketValueInHKD = convertToHKD(position.marketValue, position.currency);
                                
                                return (
                                    <TableRow key={position.id} className="text-xs">
                                        <TableCell className="sticky left-0 z-10 border-r font-medium whitespace-nowrap px-2 bg-background">
                                            <Popover 
                                                open={openActionPopover === position.id} 
                                                onOpenChange={(open) => setOpenActionPopover(open ? position.id : null)}
                                            >
                                                <PopoverTrigger asChild>
                                                    <span className="cursor-pointer hover:text-primary active:text-primary transition-colors inline-block select-none">
                                                        {position.symbol}
                                                    </span>
                                                </PopoverTrigger>
                                                <PopoverContent side="right" className="p-2 w-auto" sideOffset={5}>
                                                    <div className="flex gap-1">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-8 w-8 p-0 hover:bg-primary/10" 
                                                            onClick={() => {
                                                                openEditPosition(position);
                                                                setOpenActionPopover(null);
                                                            }}
                                                            title="Edit Position"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive" 
                                                            onClick={() => {
                                                                handleDeletePosition(position.id);
                                                                setOpenActionPopover(null);
                                                            }}
                                                            title="Delete Position"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </TableCell>
                                        <TableCell className={`text-right font-medium whitespace-nowrap px-2 ${isDayChangePositive ? 'text-profit' : 'text-loss'}`}>
                                            {position.dayChange !== undefined && position.dayChangePercent !== undefined ? (
                                                <div className="flex flex-col items-end gap-0">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {isDayChangePositive ? (
                                                            <TrendingUp className="h-3 w-3" />
                                                        ) : (
                                                            <TrendingDown className="h-3 w-3" />
                                                        )}
                                                        {formatCurrency(position.dayChange, position.currency)}
                                                    </div>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {(position.dayChangePercent || 0).toFixed(2)}%
                                                    </div>
                                                </div>
                                            ) : (
                                                'N/A'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap px-2">
                                            {formatCurrency(position.averageCost, position.currency)}
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap px-2">{position.quantity.toLocaleString()}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap px-2">
                                            {formatCurrency(position.marketPrice, position.currency)}
                                        </TableCell>
                                        <TableCell className={`text-right font-medium whitespace-nowrap px-2 ${isPositive ? 'text-profit' : 'text-loss'}`}>
                                            <div className="flex flex-col items-end gap-0">
                                                <div className="flex items-center justify-end gap-1">
                                                    {isPositive ? (
                                                        <TrendingUp className="h-3 w-3" />
                                                    ) : (
                                                        <TrendingDown className="h-3 w-3" />
                                                    )}
                                                    {formatCurrency(position.unrealizedPnl, position.currency)}
                                                </div>
                                                <div className="flex items-center justify-end gap-1">
                                                    {(pnlPercentage || 0).toFixed(2)}%
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className={`text-right font-medium whitespace-nowrap px-2 ${isPositive ? 'text-profit' : 'text-loss'}`}>
                                            {formatCurrency(pnlInHKD, 'HKD')}
                                        </TableCell>
                                        <TableCell className="text-right font-medium whitespace-nowrap px-2">
                                            {formatCurrency(marketValueInHKD, 'HKD')}
                                        </TableCell>
                                        <TableCell className="text-center text-xs px-2">
                                            {accounts.find(acc => acc.id === position.mainAccountId)?.name || 'Unknown Account'}
                                        </TableCell>
                                        <TableCell className="text-center text-xs px-2">{position.secType}</TableCell>
                                        <TableCell className="text-center text-xs px-2 truncate" title={position.country || 'N/A'}>
                                            {position.country || 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-center text-xs px-2 truncate" title={position.industry || 'N/A'}>
                                            {position.industry || 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-center text-xs px-2 truncate" title={position.category || 'N/A'}>
                                            {position.category || 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            
                            {/* Totals Row */}
                            {positions.length > 0 && (() => {
                                // Calculate totals
                                const convertToHKD = (amount: number | undefined, currency: string) => {
                                    if (!amount) return 0;
                                    const rates: Record<string, number> = {
                                        'USD': 7.8,
                                        'EUR': 8.5,
                                        'GBP': 10.0,
                                        'HKD': 1,
                                        'CNY': 1.1,
                                        'JPY': 0.05
                                    };
                                    return amount * (rates[currency] || 1);
                                };
                                
                                const totalDayChangeHKD = positions.reduce((sum, pos) => 
                                    sum + convertToHKD(pos.dayChange, pos.currency), 0
                                );
                                
                                const totalPnlHKD = positions.reduce((sum, pos) => 
                                    sum + convertToHKD(pos.unrealizedPnl, pos.currency), 0
                                );
                                
                                const totalMarketValueHKD = positions.reduce((sum, pos) => 
                                    sum + convertToHKD(pos.marketValue, pos.currency), 0
                                );
                                
                                // Calculate total previous close value in HKD
                                // Previous Close Value = closePrice * quantity (converted to HKD)
                                const totalPreviousCloseValueHKD = positions.reduce((sum, pos) => {
                                    const closePrice = pos.closePrice || 0;
                                    const quantity = pos.quantity || 0;
                                    const previousCloseValue = closePrice * quantity;
                                    return sum + convertToHKD(previousCloseValue, pos.currency);
                                }, 0);
                                
                                // Chg % = (Current Market Value / Previous Close Value - 1) * 100
                                // This matches your formula: Sum[(Previous Close + Chg)*Qty*Rate] / Sum[Previous Close*Qty*Rate] - 1
                                const totalDayChangePercent = (() => {
                                    if (!totalPreviousCloseValueHKD || totalPreviousCloseValueHKD <= 0) return 0;
                                    const percentage = ((totalMarketValueHKD / totalPreviousCloseValueHKD) - 1) * 100;
                                    return isFinite(percentage) ? percentage : 0;
                                })();
                                
                                const isTotalPositive = totalPnlHKD >= 0;
                                const isTotalDayChangePositive = totalDayChangeHKD >= 0;
                                
                                return (
                                    <TableRow className="bg-muted/50 font-semibold border-t-2 text-xs">
                                        <TableCell className="sticky left-0 z-10 border-r text-left whitespace-nowrap font-bold px-2 bg-muted/50">
                                            Total:
                                        </TableCell>
                                        <TableCell className={`text-right font-bold whitespace-nowrap px-2 ${isTotalDayChangePositive ? 'text-profit' : 'text-loss'}`}>
                                            <div className="flex flex-col items-end gap-0">
                                                <div className="flex items-center justify-end gap-1">
                                                    {isTotalDayChangePositive ? (
                                                        <TrendingUp className="h-3 w-3" />
                                                    ) : (
                                                        <TrendingDown className="h-3 w-3" />
                                                    )}
                                                    {formatCurrency(totalDayChangeHKD, 'HKD')}
                                                </div>
                                                <div className="flex items-center justify-end gap-1">
                                                    {(totalDayChangePercent || 0).toFixed(2)}%
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-2"></TableCell>
                                        <TableCell className="px-2"></TableCell>
                                        <TableCell className="px-2"></TableCell>
                                        <TableCell className={`text-right font-bold whitespace-nowrap px-2 ${isTotalPositive ? 'text-profit' : 'text-loss'}`}>
                                            <div className="flex flex-col items-end gap-0">
                                                <div className="flex items-center justify-end gap-1">
                                                    {isTotalPositive ? (
                                                        <TrendingUp className="h-3 w-3" />
                                                    ) : (
                                                        <TrendingDown className="h-3 w-3" />
                                                    )}
                                                    {formatCurrency(totalPnlHKD, 'HKD')}
                                                </div>
                                                <div>
                                                    {/* P&L % calculation for total would go here if needed */}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className={`text-right font-bold whitespace-nowrap px-2 ${isTotalPositive ? 'text-profit' : 'text-loss'}`}>
                                            {formatCurrency(totalPnlHKD, 'HKD')}
                                        </TableCell>
                                        <TableCell className="text-right font-bold whitespace-nowrap px-2">
                                            {formatCurrency(totalMarketValueHKD, 'HKD')}
                                        </TableCell>
                                        <TableCell className="px-2"></TableCell>
                                        <TableCell className="px-2"></TableCell>
                                        <TableCell className="px-2"></TableCell>
                                        <TableCell className="px-2"></TableCell>
                                        <TableCell className="px-2"></TableCell>
                                    </TableRow>
                                );
                            })()}
                        </TableBody>
                    </Table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center bg-background/30 rounded-lg">
                                <Activity className="h-10 w-10 text-muted-foreground mb-3" />
                                <h3 className="text-base font-medium text-foreground mb-1">No Positions</h3>
                                <p className="text-sm text-muted-foreground">
                                    Click "Add Position" to get started
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Cash Balances Section */}
                    <div className="border-t pt-6 -mx-4 sm:mx-0">
                        <CashBalancesSection accounts={accounts} />
                    </div>
                </CardContent>
            </Card>

            {/* Position Dialog */}
            <Dialog open={positionDialogOpen} onOpenChange={setPositionDialogOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingPosition ? 'Edit Position' : 'Add New Position'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingPosition ? 'Update position information' : 'Add a new investment position with market data from Yahoo Finance'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="account">Account</Label>
                                <Select value={positionForm.accountId} onValueChange={(value) => setPositionForm({ ...positionForm, accountId: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((account) => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                {account.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="symbol">Symbol</Label>
                                <Input
                                    id="symbol"
                                    value={positionForm.symbol}
                                    onChange={(e) => {
                                        const value = e.target.value.toUpperCase();
                                        setPositionForm({ ...positionForm, symbol: value });
                                        if (value.length > 0) {
                                            searchSymbols(value);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const value = e.target.value.toUpperCase();
                                        if (value.length > 0 && value !== editingPosition?.symbol) {
                                            fetchYahooFinanceData(value);
                                        }
                                    }}
                                    placeholder="e.g., AAPL, TSLA"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="secType">Security Type</Label>
                                <Select value={positionForm.secType} onValueChange={(value) => setPositionForm({ ...positionForm, secType: value as any })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select security type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {securityTypes.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="currency">Currency</Label>
                                <Input
                                    id="currency"
                                    value={positionForm.currency}
                                    onChange={(e) => setPositionForm({ ...positionForm, currency: e.target.value })}
                                    placeholder="USD"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="quantity">Quantity</Label>
                                <Input
                                    id="quantity"
                                    type="number"
                                    value={positionForm.quantity}
                                    onChange={(e) => setPositionForm({ ...positionForm, quantity: e.target.value })}
                                    placeholder="100"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="averageCost">Average Cost</Label>
                                <Input
                                    id="averageCost"
                                    type="number"
                                    step="0.01"
                                    value={positionForm.averageCost}
                                    onChange={(e) => setPositionForm({ ...positionForm, averageCost: e.target.value })}
                                    placeholder="150.00"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="marketPrice">Current Price</Label>
                                <Input
                                    id="marketPrice"
                                    type="number"
                                    step="0.01"
                                    value={positionForm.marketPrice}
                                    onChange={(e) => setPositionForm({ ...positionForm, marketPrice: e.target.value })}
                                    placeholder="160.00"
                                />
                            </div>
                            <div></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="country">Country</Label>
                                <Input
                                    id="country"
                                    value={positionForm.country}
                                    onChange={(e) => setPositionForm({ ...positionForm, country: e.target.value })}
                                    placeholder="United States"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="industry">Industry</Label>
                                <Input
                                    id="industry"
                                    value={positionForm.industry}
                                    onChange={(e) => setPositionForm({ ...positionForm, industry: e.target.value })}
                                    placeholder="Technology"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="category">Category</Label>
                                <Input
                                    id="category"
                                    value={positionForm.category}
                                    onChange={(e) => setPositionForm({ ...positionForm, category: e.target.value })}
                                    placeholder="Large Cap"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="exchange">Exchange</Label>
                                <Input
                                    id="exchange"
                                    value={positionForm.exchange}
                                    onChange={(e) => setPositionForm({ ...positionForm, exchange: e.target.value })}
                                    placeholder="NASDAQ"
                                />
                            </div>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPositionDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={editingPosition ? handleUpdatePosition : handleCreatePosition}>
                            {editingPosition ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OtherPortfolioView;