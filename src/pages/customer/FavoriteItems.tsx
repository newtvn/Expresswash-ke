import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, ConfirmDialog } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, Plus, ShoppingCart, Trash2 } from 'lucide-react';

interface FavoriteItem {
  id: string;
  name: string;
  type: string;
  cleaningPreference: string;
  notes: string;
}

const initialFavorites: FavoriteItem[] = [];

export const FavoriteItems = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteItem[]>(initialFavorites);
  const [addOpen, setAddOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: '', type: '', cleaningPreference: '', notes: '' });

  const handleAdd = () => {
    if (!newItem.name || !newItem.type) return;
    setFavorites((prev) => [
      ...prev,
      { id: String(Date.now()), ...newItem },
    ]);
    setNewItem({ name: '', type: '', cleaningPreference: '', notes: '' });
    setAddOpen(false);
  };

  const handleRemove = () => {
    if (removeId) {
      setFavorites((prev) => prev.filter((f) => f.id !== removeId));
      setRemoveId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Favorite Items" description="Your saved items for quick reordering">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Favorite
        </Button>
      </PageHeader>

      {favorites.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Heart className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No favorites yet. Add items for quick reordering!</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {favorites.map((item) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                <CardTitle className="text-sm font-medium">{item.name}</CardTitle>
              </div>
              <Badge variant="outline">{item.type}</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Cleaning: </span>
                  <span className="font-medium">{item.cleaningPreference}</span>
                </div>
                {item.notes && (
                  <p className="text-xs text-muted-foreground">{item.notes}</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" onClick={() => navigate('/portal/request-pickup')}>
                    <ShoppingCart className="mr-1 h-3 w-3" />
                    Reorder
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRemoveId(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {/* Add Favorite Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Favorite Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fav-name">Item Name</Label>
              <Input
                id="fav-name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g. Living Room Carpet"
              />
            </div>
            <div>
              <Label htmlFor="fav-type">Item Type</Label>
              <Select value={newItem.type} onValueChange={(v) => setNewItem({ ...newItem, type: v })}>
                <SelectTrigger id="fav-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Carpet">Carpet</SelectItem>
                  <SelectItem value="Rug">Rug</SelectItem>
                  <SelectItem value="Curtain">Curtain</SelectItem>
                  <SelectItem value="Sofa">Sofa</SelectItem>
                  <SelectItem value="Mattress">Mattress</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fav-pref">Cleaning Preference</Label>
              <Select
                value={newItem.cleaningPreference}
                onValueChange={(v) => setNewItem({ ...newItem, cleaningPreference: v })}
              >
                <SelectTrigger id="fav-pref">
                  <SelectValue placeholder="Select preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard Wash">Standard Wash</SelectItem>
                  <SelectItem value="Deep Clean">Deep Clean</SelectItem>
                  <SelectItem value="Gentle Wash">Gentle Wash</SelectItem>
                  <SelectItem value="Hand Wash">Hand Wash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fav-notes">Notes</Label>
              <Input
                id="fav-notes"
                value={newItem.notes}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                placeholder="Any special instructions"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Add to Favorites</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirm */}
      <ConfirmDialog
        open={!!removeId}
        onOpenChange={() => setRemoveId(null)}
        title="Remove Favorite"
        description="Are you sure you want to remove this item from your favorites?"
        confirmLabel="Remove"
        onConfirm={handleRemove}
        variant="destructive"
      />
    </div>
  );
};

export default FavoriteItems;
