using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class BulletBehaviour : MonoBehaviour
{
    private Rigidbody2D bulletRb;
    public float bulletSpeed;
    private Vector3 dir;
    private Vector2 bulletScale;
    private float timeToSplit = 5f;
    private int subBullets = 2;

    // Start is called before the first frame update
    void Start()
    {
        bulletScale = transform.localScale;
        bulletRb = GetComponent<Rigidbody2D>();
        transform.Rotate(0, 0, 25);
        bulletRb.velocity = transform.right * bulletSpeed;
    }

    private void OnCollisionEnter2D(Collision2D collision)
    {
        Single speed = dir.magnitude;
        Vector3 direction = Vector3.Reflect(dir.normalized, collision.contacts[0].normal);
        if (bulletRb != null) bulletRb.velocity = direction * Mathf.Max(speed, 0f);
    }

    // Update is called once per frame
    void Update()
    {
        
    }

    private void FixedUpdate()
    {
        timeToSplit -= Time.fixedDeltaTime;
        if (timeToSplit > 0)
        {
            bulletScale += new Vector2(Time.fixedDeltaTime, Time.fixedDeltaTime) / 10;
            transform.localScale = bulletScale;
        }
        else
        {
            timeToSplit = 5f;
            for (int i = 0; i < subBullets; i++)
            {
                GameObject subBullet = Instantiate(gameObject, transform.position, transform.rotation);
                subBullet.transform.Rotate(0, 0, new System.Random().Next(0, 360));
                subBullet.transform.localScale = new Vector2(0.2f, 0.2f);
            }
            Destroy(gameObject);
        }

        dir = bulletRb.velocity;
    }
}
