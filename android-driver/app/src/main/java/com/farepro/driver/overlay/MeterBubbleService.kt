package com.farepro.driver.overlay

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import com.farepro.driver.MainActivity

/**
 * Floating KM bubble while a trip meter is running (works over other apps).
 */
class MeterBubbleService : Service() {

    private var windowManager: WindowManager? = null
    private var bubble: View? = null
    private var kmText: TextView? = null
    private var statusText: TextView? = null
    private var params: WindowManager.LayoutParams? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_HIDE -> {
                removeBubble()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE -> {
                val km = intent.getDoubleExtra(EXTRA_KM, 0.0)
                val fare = intent.getIntExtra(EXTRA_FARE, 0)
                val paused = intent.getBooleanExtra(EXTRA_PAUSED, false)
                ensureBubble()
                render(km, fare, paused)
            }
            ACTION_SHOW, null -> {
                if (!Settings.canDrawOverlays(this)) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                val km = intent?.getDoubleExtra(EXTRA_KM, 0.0) ?: 0.0
                val fare = intent?.getIntExtra(EXTRA_FARE, 0) ?: 0
                val paused = intent?.getBooleanExtra(EXTRA_PAUSED, false) ?: false
                ensureBubble()
                render(km, fare, paused)
            }
        }
        return START_STICKY
    }

    private fun ensureBubble() {
        if (bubble != null) return
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val density = resources.displayMetrics.density
        val padH = (14 * density).toInt()
        val padV = (10 * density).toInt()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padH, padV, padH, padV)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = 28 * density
                setColor(0xF0141C24.toInt())
                setStroke((1.5 * density).toInt(), 0xFFF26522.toInt())
            }
            elevation = 12 * density
        }

        statusText = TextView(this).apply {
            text = "METERING"
            setTextColor(0xFFF26522.toInt())
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
            letterSpacing = 0.08f
        }
        kmText = TextView(this).apply {
            text = "0.00 km"
            setTextColor(0xFFEEF2F6.toInt())
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            paint.isFakeBoldText = true
        }
        root.addView(statusText)
        root.addView(kmText)

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = (16 * density).toInt()
            y = (120 * density).toInt()
        }

        var dragX = 0
        var dragY = 0
        var startX = 0f
        var startY = 0f
        var moved = false
        root.setOnTouchListener { _, event ->
            val p = params ?: return@setOnTouchListener false
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    dragX = p.x
                    dragY = p.y
                    startX = event.rawX
                    startY = event.rawY
                    moved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - startX).toInt()
                    val dy = (event.rawY - startY).toInt()
                    if (kotlin.math.abs(dx) > 6 || kotlin.math.abs(dy) > 6) moved = true
                    p.x = dragX + dx
                    p.y = dragY + dy
                    windowManager?.updateViewLayout(root, p)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!moved) {
                        startActivity(
                            Intent(this, MainActivity::class.java).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                putExtra(MainActivity.EXTRA_OPEN_METER, true)
                            },
                        )
                    }
                    true
                }
                else -> false
            }
        }

        bubble = root
        windowManager?.addView(root, params)
    }

    private fun render(km: Double, fare: Int, paused: Boolean) {
        kmText?.text = "%.2f km".format(km)
        statusText?.text = if (paused) "PAUSED · %,d".format(fare) else "LIVE · %,d MMK".format(fare)
        statusText?.setTextColor(if (paused) 0xFFF39C12.toInt() else 0xFFF26522.toInt())
    }

    private fun removeBubble() {
        bubble?.let { runCatching { windowManager?.removeView(it) } }
        bubble = null
        kmText = null
        statusText = null
    }

    override fun onDestroy() {
        removeBubble()
        super.onDestroy()
    }

    companion object {
        const val ACTION_SHOW = "com.farepro.driver.overlay.SHOW"
        const val ACTION_HIDE = "com.farepro.driver.overlay.HIDE"
        const val ACTION_UPDATE = "com.farepro.driver.overlay.UPDATE"
        const val EXTRA_KM = "km"
        const val EXTRA_FARE = "fare"
        const val EXTRA_PAUSED = "paused"

        fun show(context: Context, km: Double, fare: Int, paused: Boolean = false) {
            if (!Settings.canDrawOverlays(context)) return
            context.startService(
                Intent(context, MeterBubbleService::class.java).apply {
                    action = ACTION_SHOW
                    putExtra(EXTRA_KM, km)
                    putExtra(EXTRA_FARE, fare)
                    putExtra(EXTRA_PAUSED, paused)
                },
            )
        }

        fun updateKm(context: Context, km: Double, fare: Int, paused: Boolean = false) {
            if (!Settings.canDrawOverlays(context)) return
            context.startService(
                Intent(context, MeterBubbleService::class.java).apply {
                    action = ACTION_UPDATE
                    putExtra(EXTRA_KM, km)
                    putExtra(EXTRA_FARE, fare)
                    putExtra(EXTRA_PAUSED, paused)
                },
            )
        }

        fun hide(context: Context) {
            context.startService(
                Intent(context, MeterBubbleService::class.java).setAction(ACTION_HIDE),
            )
        }
    }
}
