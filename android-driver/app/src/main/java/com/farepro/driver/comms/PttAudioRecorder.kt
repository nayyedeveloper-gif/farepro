package com.farepro.driver.comms

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

data class PttClip(
    val file: File,
    val durationMs: Int,
)

/**
 * Simple hold-to-talk recorder (M4A/AAC). One clip at a time.
 */
@Singleton
class PttAudioRecorder @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private var recorder: MediaRecorder? = null
    private var file: File? = null
    private var startedAt = 0L

    val isRecording: Boolean get() = recorder != null

    fun start(): Boolean {
        if (recorder != null) return false
        return runCatching {
            val out = File(context.cacheDir, "ptt_${System.currentTimeMillis()}.m4a")
            val mr = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            mr.setAudioSource(MediaRecorder.AudioSource.MIC)
            mr.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            mr.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            mr.setAudioEncodingBitRate(64_000)
            mr.setAudioSamplingRate(16_000)
            mr.setOutputFile(out.absolutePath)
            mr.prepare()
            mr.start()
            recorder = mr
            file = out
            startedAt = System.currentTimeMillis()
            true
        }.getOrDefault(false)
    }

    fun stop(): PttClip? {
        val mr = recorder ?: return null
        val out = file
        val ms = (System.currentTimeMillis() - startedAt).toInt().coerceAtLeast(0)
        return runCatching {
            mr.stop()
            mr.release()
            recorder = null
            file = null
            if (out == null || !out.exists() || ms < 250) {
                out?.delete()
                null
            } else {
                PttClip(out, ms)
            }
        }.getOrElse {
            runCatching { mr.release() }
            recorder = null
            file = null
            out?.delete()
            null
        }
    }

    fun cancel() {
        runCatching { recorder?.stop() }
        runCatching { recorder?.release() }
        recorder = null
        file?.delete()
        file = null
    }
}
