package pt.invest.cryptoinvest

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.graphics.Path
import android.os.Build
import android.os.Bundle
import android.util.DisplayMetrics
import android.view.WindowManager
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
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val m = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(m)
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

    private fun focusedEditable(): AccessibilityNodeInfo? {
        val n = findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: rootInActiveWindow?.let { findFocusedEditable(it) }
        return if (n != null && n.isEditable) n else null
    }

    private fun setNodeText(node: AccessibilityNodeInfo, newText: String) {
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, newText)
        }
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        val sel = Bundle().apply {
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, newText.length)
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, newText.length)
        }
        node.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, sel)
    }

    fun typeText(text: String) {
        if (text.isEmpty()) return
        val node = focusedEditable() ?: return
        setNodeText(node, (node.text?.toString() ?: "") + text)
    }

    fun keyAction(key: String) {
        when (key) {
            "Backspace" -> {
                val node = focusedEditable() ?: return
                val cur = node.text?.toString() ?: ""
                if (cur.isNotEmpty()) setNodeText(node, cur.substring(0, cur.length - 1))
            }
            "Enter" -> {
                val node = findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && node != null) {
                    try { node.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id) } catch (e: Exception) {}
                }
            }
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

    fun globalAction(name: String) {
        val a = when (name) {
            "back" -> GLOBAL_ACTION_BACK
            "home" -> GLOBAL_ACTION_HOME
            "recents" -> GLOBAL_ACTION_RECENTS
            "notifications" -> GLOBAL_ACTION_NOTIFICATIONS
            else -> return
        }
        try { performGlobalAction(a) } catch (e: Exception) {}
    }

    companion object {
        @Volatile
        var instance: RemoteControlService? = null
    }
}
