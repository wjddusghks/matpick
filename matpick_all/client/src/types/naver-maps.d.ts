/* naver.maps 타입 선언 */
declare namespace naver {
  namespace maps {
    class Map {
      constructor(el: string | HTMLElement, opts?: MapOptions);
      setCenter(latlng: LatLng): void;
      setZoom(zoom: number): void;
      getCenter(): LatLng;
      getZoom(): number;
      panTo(latlng: LatLng, opts?: any): void;
      fitBounds(bounds: LatLngBounds, margin?: any): void;
      getBounds(): LatLngBounds;
      setOptions(key: string, value: any): void;
    }

    interface MapOptions {
      center?: LatLng;
      zoom?: number;
      minZoom?: number;
      maxZoom?: number;
      zoomControl?: boolean;
      zoomControlOptions?: {
        position?: any;
        style?: any;
      };
      mapTypeControl?: boolean;
      scaleControl?: boolean;
      logoControl?: boolean;
      mapDataControl?: boolean;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    class LatLngBounds {
      constructor(sw: LatLng, ne: LatLng);
      extend(latlng: LatLng): LatLngBounds;
      getCenter(): LatLng;
    }

    class Marker {
      constructor(opts?: MarkerOptions);
      setMap(map: Map | null): void;
      setPosition(latlng: LatLng): void;
      setIcon(icon: any): void;
      getPosition(): LatLng;
    }

    interface MarkerOptions {
      position?: LatLng;
      map?: Map;
      title?: string;
      icon?: any;
      clickable?: boolean;
      zIndex?: number;
    }

    class InfoWindow {
      constructor(opts?: InfoWindowOptions);
      open(map: Map, anchor?: Marker | LatLng): void;
      close(): void;
      setContent(content: string | HTMLElement): void;
    }

    interface InfoWindowOptions {
      content?: string | HTMLElement;
      maxWidth?: number;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      anchorSize?: any;
      anchorSkew?: boolean;
      anchorColor?: string;
      pixelOffset?: any;
      disableAnchor?: boolean;
    }

    class Event {
      static addListener(target: any, type: string, listener: Function): any;
      static removeListener(listener: any): void;
    }

    class Point {
      constructor(x: number, y: number);
    }

    class Size {
      constructor(width: number, height: number);
    }

    namespace Position {
      const TOP_LEFT: any;
      const TOP_CENTER: any;
      const TOP_RIGHT: any;
      const LEFT_CENTER: any;
      const CENTER: any;
      const RIGHT_CENTER: any;
      const BOTTOM_LEFT: any;
      const BOTTOM_CENTER: any;
      const BOTTOM_RIGHT: any;
    }

    namespace ZoomControlStyle {
      const SMALL: any;
      const LARGE: any;
    }

    namespace Service {
      function geocode(opts: { query: string; coordinate?: string }, callback: (status: any, response: any) => void): void;
      function reverseGeocode(opts: { coords: LatLng | string; orders?: string }, callback: (status: any, response: any) => void): void;
      namespace Status {
        const OK: string;
        const ERROR: string;
      }
    }
  }
}
