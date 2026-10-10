package com.farepro.driver.presentation.components

import android.content.Context
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

data class MapPoint(val lat: Double, val lng: Double, val title: String? = null)

@Composable
fun DriverMap(
    modifier: Modifier = Modifier,
    center: MapPoint = MapPoint(16.8661, 96.1951),
    zoom: Double = 15.0,
    markers: List<MapPoint> = emptyList(),
    path: List<MapPoint> = emptyList(),
    followCenter: Boolean = true,
) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val mapView = remember {
        ensureOsmConfig(context)
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            controller.setZoom(zoom)
            controller.setCenter(GeoPoint(center.lat, center.lng))
            minZoomLevel = 5.0
            maxZoomLevel = 20.0
        }
    }

    DisposableEffect(lifecycle, mapView) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            mapView.onDetach()
        }
    }

    AndroidView(
        modifier = modifier.fillMaxSize(),
        factory = { mapView },
        update = { map ->
            map.overlays.removeAll { it is Marker || it is Polyline }

            if (path.size >= 2) {
                val line = Polyline(map).apply {
                    setPoints(path.map { GeoPoint(it.lat, it.lng) })
                    outlinePaint.color = 0xFFF26522.toInt()
                    outlinePaint.strokeWidth = 10f
                }
                map.overlays.add(line)
            }

            markers.forEach { point ->
                val marker = Marker(map).apply {
                    position = GeoPoint(point.lat, point.lng)
                    title = point.title
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                }
                map.overlays.add(marker)
            }

            if (followCenter) {
                map.controller.animateTo(GeoPoint(center.lat, center.lng))
            }
            map.invalidate()
        },
    )
}

private fun ensureOsmConfig(context: Context) {
    Configuration.getInstance().userAgentValue = context.packageName
    Configuration.getInstance().load(
        context,
        context.getSharedPreferences("osmdroid", Context.MODE_PRIVATE),
    )
}
