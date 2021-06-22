using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PlayerCollisions : MonoBehaviour
{
    Dictionary<string, Action> powerupsCata;
    public float shieldTime, fireTime, doubleTimeTime, halveTimeTime, shrinkTime, growTime, speedUpTime, slowDownTime;
    public bool shieldOn, fireOn;

    public int playerHealth = 10;

    PlayerMvt playerMvt;

    float powerupTimeLength = 10f;

    List<float> powerupTimes;
    Color playerColor, shieldColor, fireColor, doubleTimeColor, halveTimeColor, shrinkColor, growColor, speedUpColor, slowDownColor;

    // Start is called before the first frame update
    void Start()
    {
        playerMvt = GetComponent<PlayerMvt>();

        playerColor = GetComponent<SpriteRenderer>().color;

        powerupsCata = new Dictionary<string, Action>()
        {
            { "Health", IncreasePlayerHealth },
            { "Shield", ShieldPlayer },
            { "Timex2", DoubleTimeSpeed },
            { "Time/2", HalveTimeSpeed },
            { "Raze", RazeMostBullets },
            { "Fire", PlayerBurnsBullets },
            { "Shrink", ShrinkPlayer },
            { "Grow", GrowPlayer },
            { "SpeedUp", SpeedUpPlayer },
            { "SlowDown", SlowDownPlayer },
        };

        powerupTimes = new List<float>();

        shieldColor = GameObject.Find("Shield").GetComponent<SpriteRenderer>().color;
        fireColor = GameObject.Find("Fire").GetComponent<SpriteRenderer>().color;
        shrinkColor = GameObject.Find("Shrink").GetComponent<SpriteRenderer>().color;
        growColor = GameObject.Find("Grow").GetComponent<SpriteRenderer>().color;
        speedUpColor = GameObject.Find("SpeedUp").GetComponent<SpriteRenderer>().color;
        slowDownColor = GameObject.Find("SlowDown").GetComponent<SpriteRenderer>().color;
        doubleTimeColor = GameObject.Find("Timex2").GetComponent<SpriteRenderer>().color;
        halveTimeColor = GameObject.Find("Time/2").GetComponent<SpriteRenderer>().color;
    }

    private void FixedUpdate()
    {
        if (shieldTime > 0f) shieldTime -= Time.deltaTime / Time.timeScale;
        else if (shieldTime < 0f) ShieldOff();

        if (fireTime > 0f) fireTime -= Time.deltaTime / Time.timeScale;
        else if (fireTime < 0f) FireOff();

        if (doubleTimeTime > 0f) doubleTimeTime -= Time.deltaTime / Time.timeScale;
        else if (doubleTimeTime < 0f) NormalTimeSpeed();

        if (halveTimeTime > 0f) halveTimeTime -= Time.deltaTime / Time.timeScale;
        else if (halveTimeTime < 0f) NormalTimeSpeed();

        if (speedUpTime > 0f) speedUpTime -= Time.deltaTime / Time.timeScale;
        else if (speedUpTime < 0f) NormalPlayerSpeed();

        if (slowDownTime > 0f) slowDownTime -= Time.deltaTime / Time.timeScale;
        else if (slowDownTime < 0f) NormalPlayerSpeed();

        if (growTime > 0f) growTime -= Time.deltaTime / Time.timeScale;
        else if (growTime < 0f) NormalPlayerSize();

        if (shrinkTime > 0f) shrinkTime -= Time.deltaTime / Time.timeScale;
        else if (shrinkTime < 0f) NormalPlayerSize();

        ColorSwitchHandler();

        if (playerHealth < 1) Destroy(gameObject);
    }

    private void OnCollisionEnter2D(Collision2D col)
    {
        if (col.gameObject.CompareTag("Bullet"))
        {
            if (fireOn) { 
                Destroy(col.gameObject);
                UIScript.bulletCount--;
            }

            if (!fireOn && !shieldOn) playerHealth--;
        }
    }

    private void OnTriggerEnter2D(Collider2D trig)
    {
        powerupsCata[trig.name.Substring(0, trig.name.IndexOf('('))]();
        Destroy(trig.gameObject);
    }

    void IncreasePlayerHealth()
    {
        playerHealth += 5;
    }

    void ShieldPlayer()
    {
        fireOn = false; fireTime = 0f;
        shieldOn = true;
        shieldTime += powerupTimeLength;
    }

    void DoubleTimeSpeed()
    {
        halveTimeTime = 0f;
        playerMvt.moveSpeed *= Time.timeScale;
        Time.timeScale = 2f;
        Time.fixedDeltaTime = Time.timeScale * 0.02f;
        playerMvt.moveSpeed /= Time.timeScale;
        doubleTimeTime += powerupTimeLength;
    }
    void HalveTimeSpeed()
    {
        doubleTimeTime = 0f;
        playerMvt.moveSpeed *= Time.timeScale;
        Time.timeScale = 0.1f;
        Time.fixedDeltaTime = Time.timeScale * 0.02f;
        playerMvt.moveSpeed /= Time.timeScale;
        halveTimeTime += powerupTimeLength;
    }

    void RazeMostBullets()
    {
        GameObject[] bullets = GameObject.FindGameObjectsWithTag("Bullet");
        for (int i = 3; i < bullets.Length; i++)
            Destroy(bullets[i]);
        UIScript.bulletCount = 3;
    }

    void PlayerBurnsBullets()
    {
        shieldOn = false; shieldTime = 0f;
        fireOn = true;
        fireTime += powerupTimeLength;
    }

    void ShrinkPlayer()
    {
        growTime = 0f;
        transform.localScale = new Vector2(0.2f, 0.2f);
        shrinkTime += powerupTimeLength;
    }
    void GrowPlayer()
    {
        shrinkTime = 0f;
        transform.localScale = new Vector2(0.8f, 0.8f);
        growTime += powerupTimeLength;
    }

    void SpeedUpPlayer()
    {
        slowDownTime = 0f;
        playerMvt.moveSpeed = 12f / Time.timeScale;
        speedUpTime += powerupTimeLength;
    }
    void SlowDownPlayer()
    {
        speedUpTime = 0f;
        playerMvt.moveSpeed = 2f / Time.timeScale;
        slowDownTime += powerupTimeLength;
    }

    public void ShieldOff()
    {
        shieldOn = false;
        shieldTime = 0f;
    }
    public void FireOff()
    {
        fireOn = false;
        fireTime = 0f;
    }
    public void NormalPlayerSpeed()
    {
        playerMvt.moveSpeed = 7f / Time.timeScale;
        speedUpTime = 0f;
        slowDownTime = 0f;
    }
    public void NormalPlayerSize()
    {
        transform.localScale = new Vector2(0.5f, 0.5f);
        growTime = 0f;
        shrinkTime = 0f;
    }
    public void NormalTimeSpeed()
    {
        playerMvt.moveSpeed *= Time.timeScale;
        Time.timeScale = 1f;
        Time.fixedDeltaTime = 0.02f;
        playerMvt.moveSpeed /= Time.timeScale;
        doubleTimeTime = 0f;
        halveTimeTime = 0f;
    }

    void ColorSwitchHandler()
    {
        powerupTimes.Clear();
        powerupTimes.Add(shieldTime);
        powerupTimes.Add(fireTime);
        powerupTimes.Add(speedUpTime);
        powerupTimes.Add(slowDownTime);
        powerupTimes.Add(growTime);
        powerupTimes.Add(shrinkTime);
        powerupTimes.Add(doubleTimeTime);
        powerupTimes.Add(halveTimeTime);

        powerupTimes.Sort();
        powerupTimes.Reverse();

        if (powerupTimes[0] > 0f)
        {
            Color selectedColor = Color.black;
            if (powerupTimes[0] == shieldTime) selectedColor = shieldColor;
            if (powerupTimes[0] == halveTimeTime) selectedColor = halveTimeColor;
            if (powerupTimes[0] == slowDownTime) selectedColor = slowDownColor;
            if (powerupTimes[0] == doubleTimeTime) selectedColor = doubleTimeColor;
            if (powerupTimes[0] == speedUpTime) selectedColor = speedUpColor;
            if (powerupTimes[0] == shrinkTime) selectedColor = shrinkColor;
            if (powerupTimes[0] == fireTime) selectedColor = fireColor;
            if (powerupTimes[0] == growTime) selectedColor = growColor;
            GetComponent<SpriteRenderer>().color = selectedColor;
        }
        else GetComponent<SpriteRenderer>().color = playerColor;

        for (int i = 1; i < powerupTimes.Count - 4; i++) // 4 because 4 powerups cancel other four. otherwise i would consider them all
        {
            if (powerupTimes[i] > 0f)
            {
                Color childColor = Color.black;
                if (powerupTimes[i] == shieldTime) childColor = shieldColor;
                if (powerupTimes[i] == halveTimeTime) childColor = halveTimeColor;
                if (powerupTimes[i] == slowDownTime) childColor = slowDownColor;
                if (powerupTimes[i] == doubleTimeTime) childColor = doubleTimeColor;
                if (powerupTimes[i] == speedUpTime) childColor = speedUpColor;
                if (powerupTimes[i] == shrinkTime) childColor = shrinkColor;
                if (powerupTimes[i] == fireTime) childColor = fireColor;
                if (powerupTimes[i] == growTime) childColor = growColor;
                transform.GetChild(i - 1).GetComponent<SpriteRenderer>().color = childColor;
                transform.GetChild(i - 1).GetComponent<SpriteRenderer>().sortingOrder = i;
            }
            else
            {
                transform.GetChild(i - 1).GetComponent<SpriteRenderer>().color = playerColor;
                transform.GetChild(i - 1).GetComponent<SpriteRenderer>().sortingOrder = -1;
            }
        }
    }
}
