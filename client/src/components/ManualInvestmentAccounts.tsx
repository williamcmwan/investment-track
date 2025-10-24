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
    Search,
    AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";



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

interface ManualInvestmentAccountsProps {
    accounts: MainAccount[];
}

const ManualInvestmentAccounts: React.FC<ManualInvestmentAccountsProps> = ({ accounts }) => {
    const { toast } = useToast();
    const [positions, setPositions] = useState<ManualPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        exchange: '',
        primaryExchange: '',
        notes: ''
    });

    const [symbolSearchResults, setSymbolSearchResults] = useState<SymbolSearchResult[]>([]);
    const [symbolSearchLoading, setSymbolSearchLoading] = useState(false);



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
    }, []);

    const loadPositions = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/manual-investments/positions');
            if (response.ok) {
                const data = await response.json();
                setPositions(data);
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
                    averageCost: parseFloat(positionForm.averageCost)
                })
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Position updated successfully",
                });
                await loadPositions();
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
            const response = await fetch('/api/manual-investments/positions/refresh-market-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'default' })
            });

            if (response.ok) {
                await loadPositions();
            } else {
                setError('Failed to refresh market data');
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
            exchange: '',
            primaryExchange: '',
            notes: ''
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
            exchange: position.exchange || '',
            primaryExchange: position.primaryExchange || '',
            notes: position.notes || ''
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

    return (
        <div className="space-y-6">
            {error && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Action buttons at the top */}
            <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleRefreshMarketData} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Market Data
                </Button>
                <Button onClick={() => setPositionDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Position
                </Button>
            </div>

            <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Symbol</TableHead>
                                    <TableHead>Account</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Avg Cost</TableHead>
                                    <TableHead>Market Price</TableHead>
                                    <TableHead>Market Value</TableHead>
                                    <TableHead>Day Change</TableHead>
                                    <TableHead>Unrealized P&L</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {positions.map((position) => (
                                    <TableRow key={position.id}>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{position.symbol}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {position.industry || position.category}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {accounts.find(acc => acc.id === position.mainAccountId)?.name || 'Unknown Account'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{position.secType}</Badge>
                                        </TableCell>
                                        <TableCell>{position.quantity}</TableCell>
                                        <TableCell>{formatCurrency(position.averageCost, position.currency)}</TableCell>
                                        <TableCell>{formatCurrency(position.marketPrice, position.currency)}</TableCell>
                                        <TableCell>{formatCurrency(position.marketValue, position.currency)}</TableCell>
                                        <TableCell>
                                            <div className={`${(position.dayChange || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                <div>{formatCurrency(position.dayChange, position.currency)}</div>
                                                <div className="text-sm">
                                                    {formatPercent(position.dayChangePercent)}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`${(position.unrealizedPnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(position.unrealizedPnl, position.currency)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => openEditPosition(position)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeletePosition(position.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
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
                        <div className="grid gap-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                value={positionForm.notes}
                                onChange={(e) => setPositionForm({ ...positionForm, notes: e.target.value })}
                                placeholder="Optional notes about this position"
                                rows={2}
                            />
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

export default ManualInvestmentAccounts;