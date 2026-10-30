package com.farepro.driver.presentation.components

import android.content.Context
import android.graphics.Color as AColor
import android.view.ViewGroup
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.farepro.driver.domain.GeoMath
import kotlinx.coroutines.delay
import org.osmdroid.config.Configuration
import org.osmdroid.events.MapListener
import org.osmdroid.events.ScrollEvent
import org.osmdroid.events.ZoomEvent
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.CustomZoomButtonsController
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

data class MapPoint(val lat: Double, val lng: Double, val title: String? = null)

@Composable
fun DriverMap(
    modifier: Modifier = Modifier,
    center: MapPoint = MapPoint(16.8661, 96.1951),
    zoom: Double = 16.0,
    markers: List<MapPoint> = emptyList(),
    path: List<MapPoint> = emptyList(),
    followCenter: Boolean = false,
    /** Zoom the map to fit the full route + markers (trip history / receipt). */
    fitPath: Boolean = false,
    interactive: Boolean = true,
    onUserMovedMap: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val onUserMoved = rememberUpdatedState(onUserMovedMap)

    val mapView = remember {
        ensureOsmConfig(context)
        MapView(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(interactive)
            zoomController.setVisibility(CustomZoomButtonsController.Visibility.NEVER)
            minZoomLevel = 5.0
            maxZoomLevel = 20.0
            isTilesScaledToDpi = true
            setHorizontalMapRepetitionEnabled(false)
            setVerticalMapRepetitionEnabled(false)
            controller.setZoom(zoom)
            controller.setCenter(GeoPoint(center.lat, center.lng))
        }
    }

    val routeLine = remember(mapView) {
        Polyline(mapView).apply {
            outlinePaint.color = AColor.parseColor("#1A73E8")
            outlinePaint.strokeWidth = 12f
            outlinePaint.isAntiAlias = true
        }
    }
    val youMarker = remember(mapView) {
        Marker(mapView).apply {
            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
            title = "You"
        }
    }

    var lastFollowLat by remember { mutableDoubleStateOf(0.0) }
    var lastFollowLng by remember { mutableDoubleStateOf(0.0) }
    var attached by remember { mutableStateOf(false) }

    DisposableEffect(lifecycle, mapView) {
        if (!attached) {
            mapView.overlays.add(routeLine)
            mapView.overlays.add(youMarker)
            attached = true
        }
        val listener = object : MapListener {
            override fun onScroll(event: ScrollEvent?): Boolean {
                onUserMoved.value?.invoke()
                return false
            }
            override fun onZoom(event: ZoomEvent?): Boolean {
                onUserMoved.value?.invoke()
                return false
            }
        }
        mapView.addMapListener(listener)
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        mapView.onResume()
        onDispose {
            mapView.removeMapListener(listener)
            lifecycle.removeObserver(observer)
            mapView.onPause()
            mapView.onDetach()
            attached = false
        }
    }

    LaunchedEffect(path, fitPath, markers) {
        routeLine.setPoints(
            if (path.size >= 2) path.map { GeoPoint(it.lat, it.lng) } else emptyList(),
        )
        if (fitPath) {
            val pts = buildList {
                addAll(path.map { GeoPoint(it.lat, it.lng) })
                addAll(markers.filter { it.lat != 0.0 || it.lng != 0.0 }.map { GeoPoint(it.lat, it.lng) })
            }
            if (pts.size >= 2) {
                val box = BoundingBox.fromGeoPoints(pts)
                mapView.post {
                    mapView.zoomToBoundingBox(box, false, 72)
                }
            } else if (pts.size == 1) {
                mapView.controller.setZoom(zoom)
                mapView.controller.setCenter(pts.first())
            }
        }
        mapView.postInvalidate()
    }

    LaunchedEffect(markers, center.lat, center.lng) {
        val you = markers.firstOrNull() ?: center
        if (you.lat == 0.0 && you.lng == 0.0) return@LaunchedEffect
        youMarker.position = GeoPoint(you.lat, you.lng)
        youMarker.title = you.title ?: "You"
        mapView.postInvalidate()
    }

    LaunchedEffect(followCenter) {
        if (!followCenter) return@LaunchedEffect
        if (center.lat == 0.0 && center.lng == 0.0) return@LaunchedEffect
        lastFollowLat = center.lat
        lastFollowLng = center.lng
        mapView.controller.setZoom(zoom)
        mapView.controller.setCenter(GeoPoint(center.lat, center.lng))
    }

    LaunchedEffect(center.lat, center.lng, followCenter) {
        if (!followCenter) return@LaunchedEffect
        if (center.lat == 0.0 && center.lng == 0.0) return@LaunchedEffect
        if (lastFollowLat == 0.0 && lastFollowLng == 0.0) {
            lastFollowLat = center.lat
            lastFollowLng = center.lng
            mapView.controller.setCenter(GeoPoint(center.lat, center.lng))
            return@LaunchedEffect
        }
        val d = GeoMath.distanceMeters(lastFollowLat, lastFollowLng, center.lat, center.lng)
        if (d < 12.0) return@LaunchedEffect
        delay(120)
        lastFollowLat = center.lat
        lastFollowLng = center.lng
        mapView.controller.animateTo(GeoPoint(center.lat, center.lng))
    }

    AndroidView(
        modifier = modifier.fillMaxSize(),
        factory = {
            (mapView.parent as? ViewGroup)?.removeView(mapView)
            mapView
        },
        update = {},
    )
}

private fun ensureOsmConfig(context: Context) {
    val cfg = Configuration.getInstance()
    cfg.userAgentValue = context.packageName
    cfg.load(context, context.getSharedPreferences("osmdroid", Context.MODE_PRIVATE))
}
