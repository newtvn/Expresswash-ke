import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, OverlayViewF, OverlayView } from '@react-google-maps/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

const LIBRARIES: ('places')[] = ['places'];
const DEFAULT_CENTER = { lat: -1.4747, lng: 36.9611 };
const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
};

interface LocationPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (result: { address: string; lat: number; lng: number }) => void;
  initialCenter?: { lat: number; lng: number };
  initialAddress?: string;
}

interface PlacePrediction {
  placeId: string;
  description: string;
}

export function LocationPickerModal({
  open,
  onOpenChange,
  onSelect,
  initialCenter,
  initialAddress,
}: LocationPickerModalProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    libraries: LIBRARIES,
  });

  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(initialCenter ?? null);
  const [address, setAddress] = useState(initialAddress ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [locating, setLocating] = useState(false);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (open) {
      setMarker(initialCenter ?? null);
      setAddress(initialAddress ?? '');
      setSearchQuery('');
      setPredictions([]);
      setShowPredictions(false);
      sessionTokenRef.current = null;
    }
  }, [open, initialCenter, initialAddress]);

  const getGeocoder = useCallback(() => {
    if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder();
    return geocoderRef.current;
  }, []);

  const getSessionToken = useCallback(() => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, []);

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      getGeocoder().geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) setAddress(results[0].formatted_address);
      });
    },
    [getGeocoder],
  );

  const handleSearchInput = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      if (!query.trim() || query.length < 2) {
        setPredictions([]);
        setShowPredictions(false);
        return;
      }

      searchTimeoutRef.current = setTimeout(async () => {
        if (!isLoaded) return;

        // Use the new Place Autocomplete API if available, fallback to legacy
        try {
          // @ts-expect-error - New API not yet in @types/google.maps
          if (google.maps.places.AutocompleteSuggestion) {
            // @ts-expect-error - New API
            const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: query,
              sessionToken: getSessionToken(),
              includedRegionCodes: ['ke'],
            });
            setPredictions(
              // @ts-expect-error - New API
              (suggestions || []).map((s) => ({
                placeId: s.placePrediction.placeId,
                description: s.placePrediction.text.text,
              })),
            );
            setShowPredictions(true);
          } else {
            // Fallback: use legacy AutocompleteService
            const service = new google.maps.places.AutocompleteService();
            service.getPlacePredictions(
              {
                input: query,
                componentRestrictions: { country: 'ke' },
                sessionToken: getSessionToken(),
              },
              (results, status) => {
                if (status === 'OK' && results) {
                  setPredictions(results.map((r) => ({ placeId: r.place_id, description: r.description })));
                  setShowPredictions(true);
                } else {
                  setPredictions([]);
                  setShowPredictions(false);
                }
              },
            );
          }
        } catch {
          // Fallback to geocoder
          getGeocoder().geocode(
            { address: query, componentRestrictions: { country: 'KE' } },
            (results, status) => {
              if (status === 'OK' && results) {
                setPredictions(results.map((r) => ({ placeId: r.place_id, description: r.formatted_address })));
                setShowPredictions(true);
              }
            },
          );
        }
      }, 300);
    },
    [isLoaded, getSessionToken, getGeocoder],
  );

  const selectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      setShowPredictions(false);
      setSearchQuery(prediction.description);

      try {
        // Try new Place API first
        // @ts-expect-error - New API
        if (google.maps.places.Place) {
          // @ts-expect-error - New API
          const place = new google.maps.places.Place({ id: prediction.placeId });
          // @ts-expect-error - New API
          await place.fetchFields({ fields: ['location', 'formattedAddress'] });
          const loc = place.location;
          if (loc) {
            const lat = loc.lat();
            const lng = loc.lng();
            setMarker({ lat, lng });
            setAddress(place.formattedAddress ?? prediction.description);
            mapRef.current?.panTo({ lat, lng });
            mapRef.current?.setZoom(16);
            sessionTokenRef.current = null; // Reset session after fetch
            return;
          }
        }
      } catch {
        // Fall through to geocoder
      }

      // Fallback: geocode by placeId
      getGeocoder().geocode({ placeId: prediction.placeId }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const loc = results[0].geometry.location;
          const lat = loc.lat();
          const lng = loc.lng();
          setMarker({ lat, lng });
          setAddress(results[0].formatted_address);
          mapRef.current?.panTo({ lat, lng });
          mapRef.current?.setZoom(16);
        }
      });
      sessionTokenRef.current = null;
    },
    [getGeocoder],
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarker({ lat, lng });
      reverseGeocode(lat, lng);
      setShowPredictions(false);
    },
    [reverseGeocode],
  );

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarker({ lat, lng });
        reverseGeocode(lat, lng);
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(16);
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error('Could not determine your location', {
          description: 'Try searching for your address instead',
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [reverseGeocode]);

  const handleConfirm = () => {
    if (!marker || !address) return;
    onSelect({ address, lat: marker.lat, lng: marker.lng });
    onOpenChange(false);
  };

  const center = marker ?? initialCenter ?? DEFAULT_CENTER;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden p-0" overlayClassName="bg-black/30">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Pick Location
          </DialogTitle>
          <DialogDescription className="sr-only">
            Search or tap the map to select a pickup location
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          {loadError && (
            <p className="text-sm text-destructive">Failed to load Google Maps.</p>
          )}

          {!isLoaded ? (
            <div className="flex items-center justify-center h-[350px]">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Search + Use My Location */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    placeholder="Search for a place in Kenya..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onFocus={() => predictions.length > 0 && setShowPredictions(true)}
                    onBlur={() => setTimeout(() => setShowPredictions(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && predictions.length > 0) selectPrediction(predictions[0]);
                    }}
                  />
                  {showPredictions && predictions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                      {predictions.map((p) => (
                        <button
                          key={p.placeId}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-start gap-2 border-b last:border-0"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPrediction(p)}
                        >
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="truncate">{p.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  title="Use my location"
                >
                  {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                </Button>
              </div>

              {/* Map */}
              <div className="rounded-lg overflow-hidden border">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '350px' }}
                  center={center}
                  zoom={marker ? 16 : 13}
                  onClick={handleMapClick}
                  onLoad={(map) => { mapRef.current = map; }}
                  options={MAP_OPTIONS}
                >
                  {/* Custom marker using OverlayView instead of deprecated Marker */}
                  {marker && (
                    <OverlayViewF
                      position={marker}
                      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    >
                      <div
                        className="cursor-grab active:cursor-grabbing"
                        style={{ transform: 'translate(-50%, -100%)' }}
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 bg-primary rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-white" />
                          </div>
                          <div className="w-2 h-2 bg-primary rotate-45 -mt-1" />
                        </div>
                      </div>
                    </OverlayViewF>
                  )}
                </GoogleMap>
              </div>

              {/* Selected address */}
              {address && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-muted/50 border">
                  <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{address}</p>
                    {marker && (
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!marker && !address && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  Search, tap the map, or use your location to pick a spot
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!marker || !address}>Confirm Location</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
