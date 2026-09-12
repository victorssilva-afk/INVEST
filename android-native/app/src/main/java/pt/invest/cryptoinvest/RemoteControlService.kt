package pt.invest.cryptoinvest

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Bundle
import android.util.DisplayMetrics
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Recebe comandos remotos (toque, deslize, texto) vindos do tecnico via ScreenShareService
 * e executa-os no ecra usando a API de Acessibilidade.
 */
class RemoteControlService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}
    override fun onDestroy() { if (instance === this) instance = null; super.onDestroy() }

    private fun screenSize(): Pair<Int, Int> {
        val m: DisplayMetrics = resources.displayMetrics
        return Pair(m.widthPixels, m.heightPixels)
    }

    fun doTap(nx: Double, ny: Double) {
        val (w, h) = screenSize()
        val x = (nx * w).toFloat().coerceIn(0f, (w - 1).toFloat())
        val y = (ny * h).toFloat().coerceIn(0f, (h - 1).toFloat())
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 80))
            .build()
        dispatchGesture(gesture, null, null)
    }

    fun doSwipe(nx1: Double, ny1: Double, nx2: Double, ny2: Double, durationMs: Long) {
        val (w, h) = screenSize()
        val path = Path().apply {
            moveTo((nx1 * w).toFloat(), (ny1 * h).toFloat())
            lineTo((nx2 * w).toFloat(), (ny2 * h).toFloat())
        }
        val dur = durationMs.coerceIn(80L, 2000L)
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, dur))
            .build()
        dispatchGesture(gesture, null, null)
    }

    fun typeText(text: String) {
        if (text.isEmpty()) return
        val root = rootInActiveWindow ?: return
        val focused = findFocusedEditable(root) ?: root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (focused != null && focused.isEditable) {
            val current = focused.text?.toString() ?: ""
            val args = Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, current + text)
            }
            focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        }
    }

    private fun findFocusedEditable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isEditable && node.isFocused) return node
        for (i in 0 until node.childCount) {
            val r = findFocusedEditable(node.getChild(i))
            if (r != null) return r
        }
        return null
    }

    companion object {
        @Volatile
        var instance: RemoteControlService? = null
    }
}
